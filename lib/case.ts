import { z } from 'zod';
import type { Rule } from './rules';

export const CASE_TYPES = ['billing_error', 'credential_theft', 'cancelled_recurring', 'duplicate', 'not_received', 'unknown'] as const;
export const PAYMENT_STATUSES = ['posted', 'approved', 'declined', 'invoice_only', 'unknown'] as const;
export const SIGNAL_KINDS = ['spike', 'duplicate', 'post_cancel', 'unauthorized_usage', 'retry_declined', 'dcc', 'trial_conversion', 'expired_card_rebill', 'sender_mismatch'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const ParsedSchema = z.object({
  title: z.string(),
  summary: z.string(),
  merchant: z.string().nullable(),
  descriptor: z.string().nullable(),
  caseType: z.enum(CASE_TYPES),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  amount: z.string().nullable(),
  transactionDate: z.string().nullable(),
  senderDomain: z.string().nullable(),
  signals: z.array(z.object({ kind: z.enum(SIGNAL_KINDS), evidence: z.string() })),
  facts: z.array(z.object({ label: z.string(), value: z.string(), quote: z.string() })),
});

export const ReportSchema = z.object({
  headline: z.string(),
  explanation: z.string(),
  questions: z.array(z.object({ question: z.string(), why: z.string() })),
  actions: z.array(z.object({ title: z.string(), description: z.string(), urgency: z.enum(['now', 'today', 'next']), sourceId: z.string() })),
  routes: z.array(z.object({ name: z.enum(['merchant', 'issuer', 'kca']), title: z.string(), note: z.string(), missing: z.array(z.string()) })),
  drafts: z.object({ email: z.string(), statement: z.string(), timeline: z.string() }),
  basis: z.array(z.object({ refId: z.string(), point: z.string() })),
});

export type Parsed = z.infer<typeof ParsedSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CaseType = Parsed['caseType'];

// 판단 근거로 LLM에 주입하고 화면에 인용으로 표시하는 규정·정책 조각
export type Reference = {
  id: string;
  kind: 'rule' | 'code' | 'issuer' | 'merchant' | 'authority';
  title: string;
  publisher: string;
  url: string;
  accessed: string;
  text: string;
};

export type CaseResult = {
  parsed: Parsed;
  report: Report;
  rules: Rule[];
  references: Reference[];
  verification: { domain: string | null; label: string; note: string };
  deadline: { status: 'unconfirmed'; note: string };
  mode: 'live' | 'demo';
  transcript?: string;
};

export const PAYMENT_LABEL: Record<Parsed['paymentStatus'], string> = {
  posted: '매입 내역 있음',
  approved: '승인 · 매입 확인 필요',
  declined: '승인 거절',
  invoice_only: '청구서만 확인',
  unknown: '결제 상태 확인 필요',
};

export const CASE_LABEL: Record<CaseType, string> = {
  billing_error: '청구 금액 오류',
  credential_theft: '키·계정 도용 의심',
  cancelled_recurring: '해지 후 청구',
  duplicate: '중복 청구',
  not_received: '미제공 서비스',
  unknown: '유형 확인 필요',
};

export const SIGNAL_LABEL: Record<SignalKind, string> = {
  spike: '평소보다 큰 금액',
  duplicate: '같은 금액 반복',
  post_cancel: '해지 후 청구',
  unauthorized_usage: '본인이 쓰지 않은 사용량',
  retry_declined: '승인 거절 반복 시도',
  dcc: '해외원화결제·수수료',
  trial_conversion: '무료체험 유료 전환',
  expired_card_rebill: '카드 갱신 후 재청구',
  sender_mismatch: '발신 주소 불일치',
};

export const SIGNAL_HINT: Record<SignalKind, string> = {
  spike: '사용량 요금이 갑자기 늘었다면 키가 새어 나갔거나 설정이 잘못됐을 수 있어요.',
  duplicate: '승인 문자가 두 번 온 것과 실제로 두 번 청구된 건 달라요. 매입 내역에서 확인해요.',
  post_cancel: '해지를 요청한 날과 해지가 적용되는 날이 다를 수 있어요. 이번 청구가 어느 기간 요금인지 봐야 해요.',
  unauthorized_usage: '사용 기록은 사업자가 갖고 있어요. 내가 평소에 얼마나 썼는지, 언제부터 이상했는지 정리해 두세요.',
  retry_declined: '거절이 반복되면 다른 카드나 새로 발급된 카드로 다시 시도될 수 있어요.',
  dcc: '현지 통화 대신 원화로 결제되면 수수료가 더 붙어요. 문자에 찍힌 통화를 확인해요.',
  trial_conversion: '무료 체험이 끝난 날과 첫 청구일, 미리 안내가 있었는지 확인해요.',
  expired_card_rebill: '카드를 바꿔도 가맹점이 새 카드로 계속 청구할 수 있어요. 가맹점에서 직접 해지해야 해요.',
  sender_mismatch: '청구 메일의 보낸 주소가 공식 도메인과 다르면 링크 대신 서비스에 직접 접속해 확인해요.',
};

// 첫 화면 입력 슬롯. 서버로는 헤더를 붙여 하나의 문자열로 합쳐 보낸다.
export type Slots = { sms: string; mail: string; note: string };
export const EMPTY_SLOTS: Slots = { sms: '', mail: '', note: '' };
export const SLOT_META: { key: keyof Slots; label: string; hint: string; placeholder: string }[] = [
  { key: 'sms', label: '카드 알림 문자 · 거래내역', hint: '필수', placeholder: '[Web발신] 해외승인 STRIPE *GAMMAAI USD 12,000.00 09/04 14:02 승인거절' },
  { key: 'mail', label: '청구 메일 · 청구서', hint: '선택', placeholder: '보낸 주소까지 그대로 붙여넣어 주세요' },
  { key: 'note', label: '내 상황 설명', hint: '선택', placeholder: '지난달까지 월 40달러였는데 이번 달 12,000달러가 청구됐어요. 키는 삭제했어요.' },
];
export function combineSlots(slots: Slots): string {
  return SLOT_META.map(m => { const v = slots[m.key].trim(); return v ? `[${m.label}]\n${v}` : ''; }).filter(Boolean).join('\n\n');
}

// 합쳐진 입력에서 카드 알림 문자 슬롯만 다시 꺼낸다. 규칙 파서는 이 부분만 본다.
export function smsSection(input: string): string {
  const header = `[${SLOT_META[0].label}]\n`;
  const start = input.indexOf(header);
  if (start === -1) return '';
  const body = input.slice(start + header.length);
  const end = body.search(/\n\n\[/);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

export function maskText(text: string) {
  return text
    .replace(/\b(?:sk|AIza)[-_a-zA-Z0-9]{15,}\b/g, '[API 키 숨김]')
    .replace(/\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b/g, '[전화번호 숨김]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[카드번호 숨김]')
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, '[이메일]@$1')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, '$1?[링크정보숨김]');
}

export function guardParsed(parsed: Parsed, input: string): Parsed {
  const seen = new Set<SignalKind>();
  const signals = parsed.signals.filter(s => {
    if (seen.has(s.kind) || !s.evidence.trim() || !input.includes(s.evidence)) return false;
    seen.add(s.kind);
    return true;
  }).slice(0, 5);
  const transactionDate = parsed.transactionDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.transactionDate) ? parsed.transactionDate : null;
  return {
    ...parsed,
    transactionDate,
    signals,
    facts: parsed.facts.filter(f => f.quote.trim().length > 0 && input.includes(f.quote)).slice(0, 12),
  };
}

export function deadlineFor(status: Parsed['paymentStatus']): CaseResult['deadline'] {
  return {
    status: 'unconfirmed',
    note: status === 'declined' || status === 'invoice_only'
      ? '아직 실제로 청구(매입)된 거래가 없어요. 반복 결제를 막는 상담은 지금 바로 할 수 있어요.'
      : '사유마다 기준일이 달라요. 정확한 신청 기한은 카드사에서 확인해야 해요.',
  };
}

// 화면 제목은 AI가 짓지 않는다. 사건 유형과 결제 상태로 정해진 문장을 쓴다.
export function caseTitle(parsed: Pick<Parsed, 'caseType' | 'paymentStatus' | 'amount' | 'merchant'>): string {
  const amt = parsed.amount?.trim() || '결제';
  const who = parsed.merchant?.trim() || '이 가맹점';
  const s = parsed.paymentStatus;
  const noMoney = s === 'declined' || s === 'invoice_only';
  switch (parsed.caseType) {
    case 'cancelled_recurring':
      return s === 'posted' ? `해지했는데 ${amt}가 다시 결제됐어요` : s === 'approved' ? `해지했는데 ${amt} 승인이 잡혔어요` : `해지했는데 ${amt} 청구가 다시 왔어요`;
    case 'duplicate':
      return s === 'posted' ? `${amt}가 두 번 결제됐어요` : s === 'approved' ? `${amt} 승인이 두 번 잡혔어요` : `${amt}가 두 번 청구됐어요`;
    case 'credential_theft':
      return noMoney ? '누군가 내 키를 쓴 것 같아요. 아직 돈은 안 나갔어요' : s === 'approved' ? `누군가 내 키를 써서 ${amt} 승인이 잡혔어요` : `누군가 내 키를 써서 ${amt}가 결제됐어요`;
    case 'billing_error':
      return `${amt}가 잘못 청구된 것 같아요`;
    case 'not_received':
      return `${who}에 결제했는데 서비스를 못 받았어요`;
    default:
      return `${who} 결제를 확인해야 해요`;
  }
}

// 결제 상태 옆에 붙는 한 줄 설명. "매입" 같은 말은 여기서 풀어 준다.
export const STATUS_HINT: Record<Parsed['paymentStatus'], string> = {
  posted: '카드사가 청구를 확정했어요. 이의신청은 이 상태에서 할 수 있어요.',
  approved: '승인만 잡힌 상태예요. 며칠 안에 확정되는지 카드 앱에서 확인해요.',
  declined: '승인이 거절돼서 아직 돈은 안 나갔어요. 이의신청 대상은 아직 아니에요.',
  invoice_only: '청구서만 왔고 카드 결제는 아직이에요.',
  unknown: '카드 앱에서 승인·확정 여부를 확인해 주세요.',
};

// AI 제목에 비유·수사가 섞이면 규칙 제목으로 바꾼다.
const FANCY = /퍼즐|지혈|여정|열차|티켓|차례예요|퍼즐|마지막 조각|열쇠|고비|골든타임|승부/;
export function plainHeadline(headline: string, parsed: Pick<Parsed, 'caseType' | 'paymentStatus' | 'amount' | 'merchant'>): string {
  const h = headline.trim();
  if (!h || h.length > 40 || FANCY.test(h) || /[!？?]$/.test(h)) return caseTitle(parsed);
  return h;
}
