import OpenAI from "openai";
import { CaseType, KNOWN_SENDERS, Rule, searchRules } from "./rules";

// ---------- 타입 ----------

export type StepName = "parse" | "verify" | "rules" | "deadline" | "judge" | "draft";

export type StepEvent = {
  step: StepName;
  status: "running" | "done" | "error";
  note?: string;
  data?: unknown;
};

/** 첨부 사진. data는 base64 본문(접두사 없이) */
export type ImageInput = { mime: string; data: string };

export type AmountStatus = "approved" | "declined" | "invoice_only" | "unknown";

export type Parsed = {
  case_type: CaseType;
  merchant: string | null;
  sender_domain: string | null;
  invoice_id: string | null;
  amounts: { amount: number; currency: string; date: string | null; status: AmountStatus }[];
  card_issuer: string | null;
  card_blocked: boolean | null;
  user_summary: string;
  first_transaction_date: string | null;
  merchant_contacted: boolean;
  evidence_present: string[];
  /** 첨부 사진에서 읽은 내용 요약. 사진이 없으면 null */
  image_summary: string | null;
};

export type Verify = {
  result: "official" | "suspicious" | "no_sender";
  sender_domain: string | null;
  matched_sender: string | null;
  note: string;
};

export type Deadline = {
  first_transaction_date: string;
  elapsed_days: number;
  safe_left: number;
  max_left: number;
  basis: string;
} | null;

export type RouteName = "merchant" | "issuer" | "kca";

export type Judgment = {
  headline: string;
  payment_state: string;
  immediate_actions: { action: string; why: string; urgency: "now" | "today" | "this_week" }[];
  routes: {
    name: RouteName;
    label: string;
    applicable: boolean;
    priority: number;
    reason: string;
    reason_code: string | null;
    evidence_have: string[];
    evidence_missing: string[];
  }[];
};

export type Drafts = {
  merchant_email_en: string;
  issuer_statement_ko: string;
  timeline: { date: string; event: string; source: "user" | "merchant" | "issuer" | "agent" }[];
};

export type AgentResult = {
  parsed: Parsed;
  verify: Verify;
  rules: Rule[];
  deadline: Deadline;
  judgment: Judgment;
  drafts: Drafts;
};

// ---------- 헬퍼 ----------

export function extractJson<T = unknown>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("응답에서 JSON을 찾지 못했습니다.");
  }
  return JSON.parse(text.slice(start, end + 1)) as T;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }
  return new OpenAI();
}

const MODEL = () => process.env.OPENAI_MODEL || "gpt-5.6-sol";

type UserContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

async function callJson<T>(
  client: OpenAI,
  system: string,
  user: string,
  maxTokens: number,
  opts: { images?: ImageInput[]; effort?: "low" | "medium" } = {},
): Promise<T> {
  const content: UserContent[] = [{ type: "input_text", text: user }];
  for (const img of opts.images ?? []) {
    content.push({
      type: "input_image",
      image_url: `data:${img.mime};base64,${img.data}`,
      detail: "auto",
    });
  }
  const res = await client.responses.create({
    model: MODEL(),
    instructions: system,
    input: [{ role: "user", content }],
    max_output_tokens: maxTokens,
    reasoning: { effort: opts.effort ?? "low" },
    text: { format: { type: "json_object" } },
  });
  if (res.status === "incomplete" && res.incomplete_details?.reason === "max_output_tokens") {
    throw new Error("응답이 길이 제한에 걸려 잘렸습니다.");
  }
  return extractJson<T>(res.output_text);
}

// ---------- 프롬프트 ----------

const PARSE_SYSTEM = `당신은 해외결제 분쟁 사건의 청구 메일·카드 문자·사용자 설명을 읽고 구조화하는 파서다.
규칙:
- 원문에 있는 것만 적는다. 추측 금지. 없으면 null.
- 사진이 첨부되면(청구 메일·카드 문자·콘솔 화면 캡처 등) 사진 속 글자를 원문의 일부로 읽는다. 사진에서 읽은 내용은 image_summary에 한국어 두세 문장으로 요약한다. 사진이 없으면 image_summary는 null.
- 카드 문자에 "승인거절"이 있으면 그 건은 status "declined", "승인"(해외승인 포함)이면 "approved".
- 카드 문자가 없고 청구서(인보이스·영수증 메일)만 있으면 그 금액은 "invoice_only".
- 같은 거래가 메일과 문자에 모두 있으면 한 건으로 합치고, 문자의 승인/거절 상태를 우선한다.
- first_transaction_date는 approved 또는 invoice_only 건 중 가장 이른 날짜(YYYY-MM-DD). 승인 건이 있으면 승인 건 중 가장 이른 날짜. 연도가 없으면 현재 연도를 쓴다. 승인·청구 건이 없으면 null.
- sender_domain은 From 주소의 @ 뒤 도메인만(소문자). 없으면 null.
- case_type: billing_error(사용량 없는데 청구·금액 오류), credential_theft(키·계정 탈취로 발생한 사용량), cancelled_recurring(해지 후 계속 결제), not_received(미제공·미배송), duplicate(이중 청구), unknown.
- merchant_contacted: 사용자가 가맹점(사업자)에 메일·채팅 등으로 연락한 사실이 있으면 true.
- evidence_present: 사용자가 이미 갖고 있다고 말한 증빙을 짧은 한국어 구로 나열(예: "사용량 0 대시보드 캡처", "해지 화면 캡처", "승인 문자 2건"). 첨부된 사진 자체도 증빙으로 넣는다(예: "청구 메일 캡처").
- card_blocked: 카드를 정지했으면 true, 정지하지 않았다고 했으면 false, 언급 없으면 null.
- user_summary: 사용자 상황을 한국어 두 문장으로 요약.
- 응답은 아래 스키마의 JSON 하나만. 설명·마크다운 금지.

스키마:
{
  "case_type": "billing_error|credential_theft|cancelled_recurring|not_received|duplicate|unknown",
  "merchant": string|null,
  "sender_domain": string|null,
  "invoice_id": string|null,
  "amounts": [{"amount": number, "currency": string, "date": "YYYY-MM-DD"|null, "status": "approved|declined|invoice_only|unknown"}],
  "card_issuer": string|null,
  "card_blocked": boolean|null,
  "user_summary": string,
  "first_transaction_date": "YYYY-MM-DD"|null,
  "merchant_contacted": boolean,
  "evidence_present": string[],
  "image_summary": string|null
}`;

const JUDGE_SYSTEM = `당신은 해외결제 분쟁의 제기 경로를 판정하는 에이전트다. 아래 판정 원칙을 반드시 지킨다.

판정 원칙:
1. 승인 완료(approved) 거래가 없으면 카드사 경로(issuer)는 applicable=false. 인보이스만 발행된 상태, 승인 거절 상태가 여기 해당한다. 카드사는 돌려줄 돈이 없는 거래를 다루지 않는다.
2. 본인 계정·본인 API 키에서 발생한 사용량(유출된 키 포함)은 부정사용 코드(visa-10.4, mc-4837)가 아니라 서비스 분쟁 코드(Visa 13.x, mc-4853)로 분류한다. 부정사용 코드는 카드 정보 자체가 도용된 경우에만 쓴다.
3. 가맹점(사업자)에 먼저 연락한 기록이 없으면 사업자 경로(merchant)가 카드사 경로보다 우선순위가 높다.
4. 카드 전체 정지보다 해외결제 차단(카드사 앱 안심설정)을 먼저 권한다. 즉시 행동에 "카드 정지"를 넣으려면 그 앞에 "해외결제 차단"이 있어야 한다. 단, 승인 시도가 반복되고 실제 승인될 위험이 있으면 정지도 정당하다.
5. 제공된 규정에 없는 절차·기한·서류는 만들어내지 않는다. 확실하지 않으면 "카드사에 확인"이라고 쓴다.

출력 규칙:
- routes에는 merchant, issuer, kca 세 경로를 항상 모두 넣는다. label은 각각 "사업자 이의제기", "카드사 이의신청", "소비자원 상담".
- priority는 1이 최우선. applicable=false인 경로는 priority를 가장 뒤로 두고 reason에 왜 해당 없는지 쓴다.
- reason_code는 카드사 경로가 applicable일 때만 규정 id 형식(예: "visa-13.2", "mc-4853")으로 적는다. 카드 브랜드를 알면 그 브랜드 코드 하나, 모르면 "visa-13.2 / mc-4853"처럼 둘 다. applicable=false면 null.
- evidence_have는 사용자가 이미 갖고 있는 증빙, evidence_missing은 그 경로에 더 필요한 증빙. 짧은 한국어 구.
- immediate_actions는 최대 3개. urgency는 now(지금), today(오늘 안), this_week(이번 주).
- headline은 30자 내외의 결론 한 문장. 예: "카드사 이의신청 대상 아님 — 승인된 결제가 없음".
- payment_state는 결제 상태를 한 문장으로. 예: "승인 거절 3회, 실제 출금 없음. 인보이스만 발행된 상태".
- 모든 텍스트는 한국어. 응답은 아래 스키마의 JSON 하나만. 설명·마크다운 금지.

스키마:
{
  "headline": string,
  "payment_state": string,
  "immediate_actions": [{"action": string, "why": string, "urgency": "now|today|this_week"}],
  "routes": [{
    "name": "merchant|issuer|kca",
    "label": string,
    "applicable": boolean,
    "priority": number,
    "reason": string,
    "reason_code": string|null,
    "evidence_have": string[],
    "evidence_missing": string[]
  }]
}`;

const DRAFT_SYSTEM = `당신은 해외결제 분쟁 서류를 작성하는 에이전트다. 사용자는 이 서류를 복사해 직접 보낸다. 발송은 하지 않는다.

merchant_email_en (영문 이의제기 메일) 구성 순서:
1. 제목 줄 (Subject: ...) — 인보이스 번호와 요구를 포함
2. 계정·인보이스 식별 (account email, organization/account ID, invoice number)
3. 날짜순 사실 (dated facts, bullet 형식)
4. 요구사항 (void the invoice / refund / stop retries 등 구체적으로)
5. 5영업일 회신 기한 (reply within 5 business days)
6. 사람 담당자 에스컬레이션 요청 (escalate to a human billing specialist, not an automated response)
7. 마지막 문장: 카드사 경로가 가능한 사건이면 "미회신 시 카드 발급사 분쟁 절차를 개시하겠다"는 고지. 카드사 경로가 불가능한 사건(issuer.applicable=false)이면 대신 "규제기관 및 한국소비자원 국제거래 상담을 진행하겠다"는 고지로 바꾼다.
- 정중하지만 단호하게. 위협·과장 금지. 사실은 입력에 있는 것만.
- 서명은 [Your name] / [Account email]로 플레이스홀더.

issuer_statement_ko (카드사 제출용 국문 진술서):
- issuer.applicable=false면: 첫 단락에 "카드사 이의신청 대상 아님 — (사유)"를 쓰고, 그 아래에는 향후 승인이 발생할 경우 바로 채워 쓸 수 있는 골격(제목·신청인·거래정보·사유코드·사실관계·첨부 목록 항목명만)만 둔다.
- issuer.applicable=true면: 제목, 신청인 정보(플레이스홀더), 거래 정보(가맹점·금액·승인일·카드), 사유코드(reason_code와 규정 제목), 사실관계(날짜순), 가맹점 접촉 내역, 첨부 목록(evidence_have 기준), 요청사항 순으로 작성한다.
- 규정에 없는 절차·서류를 지어내지 않는다. 카드사마다 양식이 다르므로 마지막에 "접수 전 카드사 양식 확인" 한 줄을 둔다.

timeline:
- 입력에서 확인되는 사건을 날짜순으로. source는 user(사용자 행동·상황), merchant(사업자 발송·청구), issuer(카드 승인·거절 문자).
- date는 YYYY-MM-DD. 날짜를 모르면 넣지 않는다.

응답은 아래 스키마의 JSON 하나만. 설명·마크다운 금지. 문자열 안 줄바꿈은 \\n으로.
{
  "merchant_email_en": string,
  "issuer_statement_ko": string,
  "timeline": [{"date": "YYYY-MM-DD", "event": string, "source": "user|merchant|issuer|agent"}]
}`;

// ---------- 코드 단계 ----------

export function verifySender(sender: string | null): Verify {
  if (!sender) {
    return {
      result: "no_sender",
      sender_domain: null,
      matched_sender: null,
      note: "발신 주소를 찾지 못함. 메일 원문의 보낸사람 주소를 직접 확인하세요. 링크를 누르지 말고 서비스 콘솔에 직접 접속해 청구 내역을 확인하세요.",
    };
  }
  const domain = sender.toLowerCase().trim();
  for (const [name, domains] of Object.entries(KNOWN_SENDERS)) {
    for (const d of domains) {
      if (domain === d || domain.endsWith("." + d)) {
        return {
          result: "official",
          sender_domain: domain,
          matched_sender: name,
          note: `발신 도메인 ${domain} → ${name} 정식 도메인과 일치. 피싱 가능성 낮음`,
        };
      }
    }
  }
  return {
    result: "suspicious",
    sender_domain: domain,
    matched_sender: null,
    note: `발신 도메인 ${domain}은 알려진 사업자 도메인 목록에 없음. 메일 안의 링크를 누르지 말고 서비스 콘솔에 직접 접속해 청구 내역을 확인하세요.`,
  };
}

export function computeDeadline(parsed: Parsed, now: Date): Deadline {
  const hasApproved = parsed.amounts.some((a) => a.status === "approved");
  if (!hasApproved || !parsed.first_transaction_date) return null;
  const first = new Date(parsed.first_transaction_date + "T00:00:00");
  if (Number.isNaN(first.getTime())) return null;
  const today = new Date(isoDate(now) + "T00:00:00");
  const elapsed = Math.max(0, Math.floor((today.getTime() - first.getTime()) / 86400000));
  return {
    first_transaction_date: parsed.first_transaction_date,
    elapsed_days: elapsed,
    safe_left: 90 - elapsed,
    max_left: 120 - elapsed,
    basis: `첫 승인일 ${parsed.first_transaction_date} 기준, 카드사 해외 이의신청 기한 90일(안전)·120일(최대). 정확한 기한은 카드사 확인 필요`,
  };
}

// ---------- 파이프라인 ----------

export async function runAgent(
  input: string,
  emit: (e: StepEvent) => void,
  now: Date = new Date(),
  images: ImageInput[] = [],
): Promise<AgentResult> {
  const client = getClient();
  const todayStr = isoDate(now);
  const imageNote = images.length ? `\n\n[첨부 사진] ${images.length}장이 함께 첨부되어 있다. 사진 속 글자를 원문으로 읽어라.` : "";

  // 1. parse (LLM)
  emit({ step: "parse", status: "running" });
  let parsed: Parsed;
  try {
    parsed = await callJson<Parsed>(
      client,
      PARSE_SYSTEM,
      `오늘 날짜: ${todayStr}${imageNote}\n\n[원문]\n${input || "(텍스트 없음, 사진만 첨부)"}`,
      4000,
      { images, effort: "low" },
    );
    if (!Array.isArray(parsed.amounts)) parsed.amounts = [];
    if (!Array.isArray(parsed.evidence_present)) parsed.evidence_present = [];
    if (typeof parsed.image_summary !== "string") parsed.image_summary = null;
  } catch (err) {
    emit({ step: "parse", status: "error", note: `청구 내용을 읽지 못했습니다: ${(err as Error).message}` });
    throw err;
  }
  const approvedCount = parsed.amounts.filter((a) => a.status === "approved").length;
  const declinedCount = parsed.amounts.filter((a) => a.status === "declined").length;
  const invoiceCount = parsed.amounts.filter((a) => a.status === "invoice_only").length;
  const stateParts: string[] = [];
  if (approvedCount) stateParts.push(`승인 ${approvedCount}건`);
  if (declinedCount) stateParts.push(`승인거절 ${declinedCount}건`);
  if (invoiceCount) stateParts.push(`청구서만 ${invoiceCount}건`);
  emit({
    step: "parse",
    status: "done",
    note: `가맹점 ${parsed.merchant ?? "미확인"} · 사건 유형 ${caseLabel(parsed.case_type)} · ${stateParts.join(", ") || "거래 상태 미확인"}${parsed.invoice_id ? ` · 인보이스 ${parsed.invoice_id}` : ""}${images.length ? ` · 사진 ${images.length}장 판독` : ""}`,
    data: parsed,
  });

  // 2. verify (code)
  emit({ step: "verify", status: "running" });
  const verify = verifySender(parsed.sender_domain);
  emit({ step: "verify", status: "done", note: verify.note, data: verify });

  // 3. rules (code)
  emit({ step: "rules", status: "running" });
  const rules = searchRules(parsed.case_type, `${input}\n${parsed.image_summary ?? ""}\n${parsed.user_summary}`);
  emit({
    step: "rules",
    status: "done",
    note: rules.length
      ? `적용 규정 ${rules.length}건: ${rules.map((r) => r.id).join(", ")}`
      : "일치하는 규정을 찾지 못함",
    data: rules,
  });

  // 4. deadline (code)
  emit({ step: "deadline", status: "running" });
  const deadline = computeDeadline(parsed, now);
  emit({
    step: "deadline",
    status: "done",
    note: deadline
      ? `첫 승인일 ${deadline.first_transaction_date}부터 ${deadline.elapsed_days}일 경과 → 안전 기한 D-${deadline.safe_left}, 최대 기한 D-${deadline.max_left}`
      : "승인 완료된 거래 없음 → 카드사 이의신청 대상 아님. 시한 계산 생략",
    data: deadline,
  });

  // 5. judge (LLM)
  emit({ step: "judge", status: "running" });
  let judgment: Judgment;
  try {
    const judgeUser = [
      `오늘 날짜: ${todayStr}`,
      `[parsed]\n${JSON.stringify(parsed, null, 2)}`,
      `[verify]\n${verify.note}`,
      `[deadline]\n${deadline ? JSON.stringify(deadline, null, 2) : "null (승인 완료 거래 없음)"}`,
      `[rules]\n${rules.map((r) => `- ${r.id} | ${r.title}\n  ${r.body}`).join("\n")}`,
      parsed.image_summary ? `[첨부 사진 요약]\n${parsed.image_summary}` : "",
      `[원문]\n${input || "(텍스트 없음, 사진만 첨부)"}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    judgment = await callJson<Judgment>(client, JUDGE_SYSTEM, judgeUser, 6000, { effort: "medium" });
    judgment = normalizeJudgment(judgment);
  } catch (err) {
    emit({ step: "judge", status: "error", note: `경로를 판정하지 못했습니다: ${(err as Error).message}` });
    throw err;
  }
  const top = [...judgment.routes].sort((a, b) => a.priority - b.priority).find((r) => r.applicable);
  const issuer = judgment.routes.find((r) => r.name === "issuer");
  emit({
    step: "judge",
    status: "done",
    note: `${judgment.headline} · 최우선 경로: ${top?.label ?? "없음"}${issuer?.applicable ? ` · 사유코드 ${issuer.reason_code ?? "미정"}` : " · 카드사 경로 해당 없음"}`,
    data: judgment,
  });

  // 6. draft (LLM)
  emit({ step: "draft", status: "running" });
  let drafts: Drafts;
  try {
    const draftUser = [
      `오늘 날짜: ${todayStr}`,
      `[parsed]\n${JSON.stringify(parsed, null, 2)}`,
      `[judgment]\n${JSON.stringify(judgment, null, 2)}`,
      `[rules]\n${rules.map((r) => `- ${r.id} | ${r.title}\n  ${r.body}`).join("\n")}`,
    ].join("\n\n");
    drafts = await callJson<Drafts>(client, DRAFT_SYSTEM, draftUser, 8000, { effort: "low" });
    if (!Array.isArray(drafts.timeline)) drafts.timeline = [];
    drafts.timeline.push({ date: todayStr, event: "이의제기 메일 초안 생성", source: "agent" });
    drafts.timeline.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  } catch (err) {
    emit({ step: "draft", status: "error", note: `서류를 작성하지 못했습니다: ${(err as Error).message}` });
    throw err;
  }
  emit({
    step: "draft",
    status: "done",
    note: `영문 이의제기 메일, 카드사 진술서${issuer?.applicable ? "" : "(골격)"}, 타임라인 ${drafts.timeline.length}건 작성`,
    data: drafts,
  });

  return { parsed, verify, rules, deadline, judgment, drafts };
}

// ---------- 후처리 ----------

const ROUTE_LABEL: Record<RouteName, string> = {
  merchant: "사업자 이의제기",
  issuer: "카드사 이의신청",
  kca: "소비자원 상담",
};

function normalizeJudgment(j: Judgment): Judgment {
  const routes = Array.isArray(j.routes) ? j.routes : [];
  const names: RouteName[] = ["merchant", "issuer", "kca"];
  const full = names.map((name) => {
    const found = routes.find((r) => r.name === name);
    if (found) {
      return {
        ...found,
        label: ROUTE_LABEL[name],
        evidence_have: Array.isArray(found.evidence_have) ? found.evidence_have : [],
        evidence_missing: Array.isArray(found.evidence_missing) ? found.evidence_missing : [],
        reason_code: found.applicable ? found.reason_code ?? null : null,
      };
    }
    return {
      name,
      label: ROUTE_LABEL[name],
      applicable: false,
      priority: 99,
      reason: "판정 결과에 포함되지 않음",
      reason_code: null,
      evidence_have: [],
      evidence_missing: [],
    };
  });
  return {
    ...j,
    immediate_actions: (Array.isArray(j.immediate_actions) ? j.immediate_actions : []).slice(0, 3),
    routes: full,
  };
}

export function caseLabel(c: CaseType): string {
  switch (c) {
    case "billing_error":
      return "청구 오류";
    case "credential_theft":
      return "키·계정 탈취 사용량";
    case "cancelled_recurring":
      return "해지 후 결제";
    case "not_received":
      return "미제공";
    case "duplicate":
      return "이중 청구";
    default:
      return "미분류";
  }
}
