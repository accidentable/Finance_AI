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
});

export type Parsed = z.infer<typeof ParsedSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CaseType = Parsed['caseType'];
export type CaseResult = {
  parsed: Parsed;
  report: Report;
  rules: Rule[];
  verification: { domain: string | null; label: string; note: string };
  deadline: { status: 'unconfirmed'; note: string };
  mode: 'live' | 'demo';
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
  spike: '사용량 과금에서 급증은 키 유출이나 설정 오류의 첫 신호입니다.',
  duplicate: '승인 알림 중복과 실제 매입 두 건은 다릅니다. 매입 내역으로 구분합니다.',
  post_cancel: '해지 요청일과 해지 효력일이 다를 수 있어 청구 대상 기간 확인이 필요합니다.',
  unauthorized_usage: '사용 기록은 사업자가 보유합니다. 본인 사용량 기준과 시점을 정리해 두세요.',
  retry_declined: '거절이 반복되면 다른 카드나 갱신 카드로 재시도될 수 있습니다.',
  dcc: '현지 통화 대신 원화로 결제되면 추가 수수료가 붙습니다. 통화 표시를 확인하세요.',
  trial_conversion: '체험 종료일과 첫 청구일, 사전 안내 여부를 확인합니다.',
  expired_card_rebill: '토큰 결제 가맹점은 갱신 카드로 계속 청구할 수 있습니다. 가맹점 해지가 필요합니다.',
  sender_mismatch: '청구 메일의 발신 주소가 공식 도메인과 다르면 직접 접속해 확인합니다.',
};

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
      ? '매입된 거래가 확인되지 않았습니다. 반복 결제 방지 상담은 지금 진행할 수 있습니다.'
      : '사유별 기준일과 카드사 접수 요건 확인이 필요합니다. 임의로 신청기한을 계산하지 않습니다.',
  };
}
