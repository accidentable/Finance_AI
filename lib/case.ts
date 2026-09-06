import { z } from 'zod';
import type { Rule } from './rules';
export const ParsedSchema = z.object({
  title: z.string(), summary: z.string(), merchant: z.string().nullable(),
  caseType: z.enum(['billing_error', 'credential_theft', 'cancelled_recurring', 'duplicate', 'not_received', 'unknown']),
  paymentStatus: z.enum(['posted', 'approved', 'declined', 'invoice_only', 'unknown']),
  amount: z.string().nullable(), senderDomain: z.string().nullable(),
  facts: z.array(z.object({ label: z.string(), value: z.string(), quote: z.string() })),
});
export const ReportSchema = z.object({
  headline: z.string(), explanation: z.string(),
  questions: z.array(z.object({ question: z.string(), why: z.string() })),
  actions: z.array(z.object({ title: z.string(), description: z.string(), urgency: z.enum(['now', 'today', 'next']), sourceId: z.string() })),
  routes: z.array(z.object({ name: z.enum(['merchant', 'issuer', 'kca']), title: z.string(), note: z.string(), missing: z.array(z.string()) })),
  drafts: z.object({ email: z.string(), statement: z.string(), timeline: z.string() }),
});
export type Parsed = z.infer<typeof ParsedSchema>;
export type Report = z.infer<typeof ReportSchema>;
export type CaseResult = { parsed: Parsed; report: Report; rules: Rule[]; verification: { domain: string | null; label: string; note: string }; deadline: { status: 'unconfirmed'; note: string }; mode: 'live' | 'demo' };
export const PAYMENT_LABEL: Record<Parsed['paymentStatus'], string> = { posted: '매입 내역 있음', approved: '승인 · 매입 확인 필요', declined: '승인 거절', invoice_only: '청구서만 확인', unknown: '결제 상태 확인 필요' };
export function maskText(text: string) {
  return text.replace(/\b(?:sk|AIza)[-_a-zA-Z0-9]{15,}\b/g, '[API 키 숨김]')
    .replace(/\b01[016789][- .]?\d{3,4}[- .]?\d{4}\b/g, '[전화번호 숨김]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[카드번호 숨김]')
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, '[이메일]@$1')
    .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/g, '$1?[링크정보숨김]');
}
export function guardParsed(parsed: Parsed, input: string): Parsed {
  return { ...parsed, facts: parsed.facts.filter(f => f.quote.trim().length > 0 && input.includes(f.quote)).slice(0, 12) };
}
export function deadlineFor(status: Parsed['paymentStatus']): CaseResult['deadline'] {
  return { status: 'unconfirmed', note: status === 'declined' || status === 'invoice_only' ? '매입된 거래가 확인되지 않았습니다. 반복 결제 방지 상담은 지금 진행할 수 있습니다.' : '사유별 기준일과 카드사 접수 요건 확인이 필요합니다. 임의로 신청기한을 계산하지 않습니다.' };
}
