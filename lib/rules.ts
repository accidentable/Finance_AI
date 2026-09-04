export type CaseType =
  | "billing_error"
  | "credential_theft"
  | "cancelled_recurring"
  | "not_received"
  | "duplicate"
  | "unknown";

export type RuleSource = "visa" | "mastercard" | "issuer_kr" | "kca" | "fss";

export type Rule = {
  id: string;
  source: RuleSource;
  title: string;
  body: string;
  caseTypes: CaseType[];
  keywords: string[];
  /** 사실 확인이 안 된 항목(기한 일수, 서류 목록 등). 화면에 "원문 확인 필요"로 표시 */
  verify?: boolean;
};

export const SOURCE_LABEL: Record<RuleSource, string> = {
  visa: "Visa 분쟁 규정",
  mastercard: "Mastercard 분쟁 규정",
  issuer_kr: "국내 카드사 해외 이의신청 절차",
  kca: "한국소비자원 국제거래 소비자포털",
  fss: "금융감독원 안내",
};

const ALL: CaseType[] = [
  "billing_error",
  "credential_theft",
  "cancelled_recurring",
  "not_received",
  "duplicate",
  "unknown",
];

export const RULES: Rule[] = [
  // ---------- Visa ----------
  {
    id: "visa-10.4",
    source: "visa",
    title: "Visa 10.4 — 카드 부재 거래 부정사용 (Other Fraud, Card-Absent)",
    body:
      "카드 소지자가 승인하지 않았고 참여하지도 않은 온라인·비대면 거래에 적용된다. 카드 소지자 본인의 계정이나 API 키를 통해 발생한 거래는 본인이 가맹점과 거래 관계를 맺은 것으로 보아 이 코드가 아니라 서비스 분쟁 코드(13.x)로 분류된다. 카드 정보 자체가 도용된 경우에만 해당한다.",
    caseTypes: ["credential_theft", "unknown"],
    keywords: ["부정사용", "도용", "fraud", "unauthorized", "모르는 결제", "카드 정보 유출"],
  },
  {
    id: "visa-12.5",
    source: "visa",
    title: "Visa 12.5 — 금액 오류 (Incorrect Amount)",
    body:
      "거래 금액이 카드 소지자가 동의한 금액과 다르게 처리된 경우. 동의한 금액을 보여주는 주문 확인·요금표·계약 화면과 실제 청구 금액의 차이를 증빙으로 제출한다. 사용량 기반 과금에서 사용 기록과 청구액이 맞지 않는 경우에도 검토 대상이다.",
    caseTypes: ["billing_error", "duplicate"],
    keywords: ["금액 오류", "과다 청구", "incorrect amount", "잘못 청구", "사용량", "usage", "요금"],
  },
  {
    id: "visa-13.1",
    source: "visa",
    title: "Visa 13.1 — 상품·서비스 미제공 (Merchandise/Services Not Received)",
    body:
      "결제했으나 상품 또는 서비스가 약속된 날짜까지 제공되지 않은 경우. 먼저 가맹점에 연락해 해결을 시도한 기록이 필요하다. 배송 예정일·서비스 제공 약속 화면, 미제공 사실, 가맹점 접촉 내역을 제출한다.",
    caseTypes: ["not_received"],
    keywords: ["미배송", "미제공", "not received", "배송", "도착하지", "제공되지"],
  },
  {
    id: "visa-13.2",
    source: "visa",
    title: "Visa 13.2 — 해지된 정기결제 (Cancelled Recurring Transaction)",
    body:
      "카드 소지자가 정기결제(구독)를 해지했거나 가맹점에 해지 의사를 알렸는데도 이후 결제가 발생한 경우. 해지 요청 일시와 방법(해지 화면 캡처, 해지 확인 메일, 고객센터 문의 기록)이 핵심 증빙이다. 해지 이후 발생한 결제 건마다 제기할 수 있다.",
    caseTypes: ["cancelled_recurring"],
    keywords: ["해지", "구독", "정기결제", "cancel", "subscription", "recurring", "자동결제", "갱신"],
  },
  {
    id: "visa-13.6",
    source: "visa",
    title: "Visa 13.6 — 환불 미처리 (Credit Not Processed)",
    body:
      "가맹점이 환불·취소를 약속했거나 환불 조건에 해당하는데 환불이 처리되지 않은 경우. 환불 약속 메일, 취소 확인 화면, 가맹점 환불 정책 화면을 증빙으로 제출한다.",
    caseTypes: ["cancelled_recurring", "billing_error", "not_received"],
    keywords: ["환불", "refund", "credit", "취소", "환불 약속"],
  },
  // ---------- Mastercard ----------
  {
    id: "mc-4837",
    source: "mastercard",
    title: "Mastercard 4837 — 카드 소지자 미승인 거래 (No Cardholder Authorization)",
    body:
      "카드 소지자가 승인하지 않은 거래에 적용된다. 카드 소지자 본인의 계정이나 API 키를 통해 발생한 사용량은 본인이 가맹점과 계약한 서비스의 사용 문제로 보아 이 코드가 아니라 4853(카드 소지자 분쟁)으로 분류된다.",
    caseTypes: ["credential_theft", "unknown"],
    keywords: ["부정사용", "도용", "fraud", "unauthorized", "모르는 결제", "카드 정보 유출"],
  },
  {
    id: "mc-4853",
    source: "mastercard",
    title: "Mastercard 4853 — 카드 소지자 분쟁 (Cardholder Dispute)",
    body:
      "서비스 미제공, 해지된 정기결제, 설명과 다른 서비스, 환불 미처리 등 카드 소지자와 가맹점 사이의 분쟁을 포괄하는 코드. 가맹점에 먼저 해결을 시도한 기록과 그 결과(무응답 포함)를 제출해야 한다. 해지 후 결제는 해지 증빙, 미제공은 제공 약속 화면이 필요하다.",
    caseTypes: ["cancelled_recurring", "not_received", "billing_error", "credential_theft"],
    keywords: ["해지", "구독", "미제공", "환불", "분쟁", "dispute", "사용량", "usage", "청구"],
  },
  {
    id: "mc-4834",
    source: "mastercard",
    title: "Mastercard 4834 — 거래 처리 오류 (Point-of-Interaction Error)",
    body:
      "같은 거래가 두 번 이상 처리된 이중 청구, 다른 결제수단으로 이미 지불한 거래의 재청구, 금액 불일치 등 처리 오류. 같은 금액·같은 날짜의 승인 문자 두 건, 또는 다른 수단으로 결제한 영수증이 증빙이다.",
    caseTypes: ["duplicate", "billing_error"],
    keywords: ["이중 청구", "중복", "duplicate", "두 번", "2회", "같은 금액", "금액 불일치"],
  },
  // ---------- 국내 카드사 ----------
  {
    id: "issuer-kr-deadline",
    source: "issuer_kr",
    title: "국내 카드사 해외 이의신청 기한 — 승인일로부터 90~120일",
    body:
      "해외 거래 이의신청은 브랜드사 규정에 따라 거래일(승인일)로부터 통상 90일에서 120일 안에 접수해야 한다. 카드사마다 안내 기한이 다르므로 90일을 안전 기한, 120일을 최대 기한으로 본다. 기한이 지나면 카드사가 브랜드사에 제기할 수 없다.",
    caseTypes: ALL,
    keywords: ["기한", "승인", "이의신청", "언제까지", "일 이내"],
    verify: true,
  },
  {
    id: "issuer-kr-approved-only",
    source: "issuer_kr",
    title: "국내 카드사 이의신청 대상 — 승인 완료된 거래만",
    body:
      "카드사 해외 이의신청(차지백)은 실제로 승인·매입된 거래에 대해서만 제기할 수 있다. 가맹점이 청구서(인보이스)만 발행한 상태, 승인이 거절된 상태는 카드사가 돌려줄 돈이 없으므로 대상이 아니다. 이 경우 가맹점과 직접 해결하거나 소비자원 상담을 이용한다.",
    caseTypes: ["billing_error", "credential_theft", "unknown"],
    keywords: ["승인거절", "승인 거절", "거절", "인보이스", "invoice", "청구서", "declined", "한도초과"],
  },
  {
    id: "issuer-kr-fraud-block",
    source: "issuer_kr",
    title: "부정사용 의심 시 카드 정지보다 해외결제 차단(안심설정) 우선",
    body:
      "카드 정보 도용이 의심되면 카드 전체를 정지하기 전에 카드사 앱의 해외결제 차단(해외거래 안심설정)으로 해외 승인만 막을 수 있다. 국내 사용은 유지되고 정기결제·교통·통신 자동이체가 끊기지 않는다. 다만 승인 시도가 반복되고 실제 승인될 위험이 있으면 카드 정지·재발급이 정당하다. 신고는 카드사 고객센터 전화가 가장 빠르다.",
    caseTypes: ["billing_error", "credential_theft", "unknown", "cancelled_recurring"],
    keywords: ["해외결제 차단", "안심설정", "카드 정지", "재발급", "승인 시도", "반복", "차단", "승인거절"],
  },
  {
    id: "issuer-kr-docs",
    source: "issuer_kr",
    title: "국내 카드사 해외 이의신청 사유별 필수 서류",
    body:
      "공통: 이의신청서(카드사 양식), 거래내역, 가맹점과 주고받은 메일·채팅 기록. 해지 후 결제: 해지 요청 화면·확인 메일. 미제공: 주문 확인서·배송 조회 화면. 이중 청구: 승인 문자 2건·영수증. 금액 오류: 동의한 금액이 보이는 화면과 청구 화면. 부정사용: 부정사용 신고 접수 확인. 서류 목록은 카드사마다 다르므로 접수 전 카드사에 확인한다.",
    caseTypes: ["billing_error", "credential_theft", "cancelled_recurring", "not_received", "duplicate"],
    keywords: ["서류", "증빙", "첨부", "이의신청서", "캡처", "영수증", "기록"],
    verify: true,
  },
  // ---------- 한국소비자원 ----------
  {
    id: "kca-45days",
    source: "kca",
    title: "국제거래 소비자포털 — 해외 사업자 45일 내 답변 의무",
    body:
      "한국소비자원 국제거래 소비자포털에 상담을 접수하면 소비자원이 해외 사업자에게 내용을 전달하고 사업자는 45일 이내에 답변해야 한다. 사업자의 무응답 자체가 기록으로 남아 이후 카드사 이의신청의 가맹점 접촉 시도 증빙으로 쓸 수 있다.",
    caseTypes: ALL,
    keywords: ["소비자원", "국제거래", "무응답", "답변", "봇", "자동 회신", "auto-reply", "회신 없음"],
    verify: true,
  },
  {
    id: "kca-120days",
    source: "kca",
    title: "국제거래 소비자포털 — 신청 기한 120일",
    body:
      "국제거래 소비자 상담은 거래일로부터 120일 이내에 신청해야 접수된다. 카드사 이의신청 기한과 별개로 진행되므로 카드사 경로가 막힌 사건(청구서만 발행, 승인 거절)에서도 이용할 수 있다.",
    caseTypes: ALL,
    keywords: ["소비자원", "국제거래", "기한", "120일", "상담"],
    verify: true,
  },
  {
    id: "kca-consult",
    source: "kca",
    title: "국제거래 소비자포털 — 상담 경로",
    body:
      "한국소비자원 국제거래 소비자포털(crossborder.kca.go.kr)에서 온라인 상담을 신청한다. 준비물: 거래 내역, 사업자와 주고받은 메일, 청구서, 사업자 이름과 사이트 주소. 소비자원은 법적 강제력이 없지만 해외 사업자와의 조정과 기록 확보에 쓸 수 있다.",
    caseTypes: ALL,
    keywords: ["소비자원", "상담", "국제거래", "신고", "어디에"],
  },
  // ---------- 금융감독원 ----------
  {
    id: "fss-authority",
    source: "fss",
    title: "금감원 안내 — 해외 이의신청 판정 권한은 브랜드사, 최대 5개월",
    body:
      "해외 거래 이의신청은 국내 카드사가 접수하지만 판정은 Visa·Mastercard 등 브랜드사의 규정과 절차에 따라 이루어진다. 가맹점 반박과 재심을 거치면 최종 결과까지 최대 5개월가량 걸릴 수 있다. 카드사는 접수 창구이므로 증빙이 사유코드 요건에 맞는지가 결과를 좌우한다.",
    caseTypes: ALL,
    keywords: ["금감원", "카드사", "브랜드사", "판정", "얼마나 걸리", "기간", "결과"],
  },
  // ---------- 해외 사업자 에스컬레이션 ----------
  {
    id: "merchant-escalation",
    source: "kca",
    title: "해외 사업자 이의제기 요령 — 단일 티켓, 식별자, 회신 기한",
    body:
      "해외 사업자는 자동 응답 봇이 1차 응대를 맡는 경우가 많다. 여러 주소로 나눠 보내면 티켓이 흩어져 사람에게 도달하지 못한다. 한 통에 계정 이메일·인보이스 번호·조직 ID를 명시하고, 날짜순으로 사실을 적고, 구체적 요구(청구 취소·환불)와 회신 기한(5영업일)을 정한 뒤, 사람 담당자 에스컬레이션을 요청한다. 미회신 시 카드 발급사 분쟁 절차 또는 소비자 보호기관 상담으로 진행하겠다고 고지하면 우선 처리되는 경우가 많다.",
    caseTypes: ALL,
    keywords: ["봇", "자동 회신", "auto-reply", "support", "티켓", "ticket", "회신", "담당자", "무응답", "메일"],
  },
];

/** 사업자명 → 정식 발신 도메인 목록. 하위 도메인(mail.anthropic.com 등)은 접미사 일치로 인정 */
export const KNOWN_SENDERS: Record<string, string[]> = {
  Anthropic: ["anthropic.com"],
  OpenAI: ["openai.com"],
  Google: ["google.com"],
  X: ["x.com", "twitter.com"],
  AWS: ["amazon.com", "amazonaws.com"],
  Stripe: ["stripe.com"],
};

export function searchRules(caseType: CaseType, text: string, limit = 6): Rule[] {
  const lower = text.toLowerCase();
  const scored = RULES.map((rule) => {
    let score = 0;
    if (rule.caseTypes.includes(caseType)) score += 3;
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    return { rule, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.rule);
}
