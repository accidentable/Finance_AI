// data/ 아래 수집 자료를 타입과 함께 읽어 오는 로더. LLM 없이 동작하며, 출처와 조회일을 항상 함께 돌려준다.
import issuersJson from '@/data/issuers.json';
import reasonCodesJson from '@/data/reason-codes.json';
import merchantsJson from '@/data/merchant-policies.json';
import authoritiesJson from '@/data/authorities.json';
import patternsJson from '@/data/notification-patterns.json';
import type { CaseType, Parsed } from './case';

export type Source = { title: string; url: string; accessed: string; kind: 'official' | 'news' | 'community' | 'secondary' };
export type Verified = 'official' | 'partial' | 'secondary' | 'community' | 'pattern-only';

export type Issuer = {
  id: string; name: string; phone: string;
  channels: { type: 'web' | 'app' | 'phone' | 'branch' | 'fax' | 'mail' | 'email'; label: string; url?: string }[];
  deadline: string; reasons: string[]; documents: string[]; processing: string; notes: string[];
  verified: Verified; sources: Source[];
};
export type ReasonCode = {
  network: 'visa' | 'mastercard'; code: string; name: string; category: string; timeLimit: string; when: string;
  caseTypes: CaseType[]; koreanNote: string; evidence: string[]; merchantFirst: boolean;
};
export type MerchantPolicy = {
  id: string; name: string; category: string; usageBased: boolean; processor?: boolean; descriptors: string[];
  refund: string; cancellation: string; unauthorized: string; processingTime: string;
  channels: { label: string; url: string }[]; notes: string[]; verified: Verified; sources: Source[];
};
export type Authority = { id: string; publisher: string; title: string; date: string; points: string[]; sources: Source[] };

export const ISSUERS = issuersJson.issuers as Issuer[];
export const REASON_CODE_LIST = reasonCodesJson.codes as ReasonCode[];
export const REASON_CODE_SOURCES = reasonCodesJson.sources as Source[];
export const MERCHANT_POLICIES = merchantsJson.merchants as MerchantPolicy[];
export const AUTHORITIES = authoritiesJson.items as Authority[];
export const KNOWLEDGE_ACCESSED = issuersJson.accessed;

export function findIssuer(text: string | null | undefined): Issuer | null {
  if (!text) return null;
  const t = text.replace(/\s/g, '');
  const aliases: Record<string, string[]> = {
    shinhan: ['신한'], samsung: ['삼성'], hyundai: ['현대'], kb: ['KB', '국민'], lotte: ['롯데'], hana: ['하나'], woori: ['우리'], bc: ['BC', '비씨'], nh: ['NH', '농협'],
  };
  for (const issuer of ISSUERS) if (aliases[issuer.id]?.some(a => t.includes(a + '카드') || t.includes(a + 'Pay') || t === a)) return issuer;
  return null;
}

export const VERIFIED_LABEL: Record<Verified, string> = {
  official: '공식 페이지 확인',
  partial: '일부 확인 · 카드사 확인 필요',
  secondary: '2차 자료 · 원문 대조 필요',
  community: '이용자 경험 · 확정 아님',
  'pattern-only': '패턴만 · 샘플 미검증',
};

// 사건 유형을 카드사가 쓰는 사유 명칭으로 옮긴다. 카드사 목록에 맞는 문구가 없으면 null.
const REASON_KEYWORDS: Record<CaseType, string[]> = {
  cancelled_recurring: ['취소', '해지'],
  duplicate: ['이중', '중복'],
  billing_error: ['금액', '상이', '정정', '오류'],
  credential_theft: ['미사용', '사용사실', '부정', '본인', '결제하지 않은'],
  not_received: ['미수령', '미제공', '받지 못', '미도착'],
  unknown: [],
};
export function issuerReasonFor(issuer: Issuer | null, caseType: CaseType): string | null {
  if (!issuer) return null;
  const keys = REASON_KEYWORDS[caseType];
  return issuer.reasons.find(r => keys.some(k => r.includes(k))) ?? null;
}

export function findMerchantPolicy(descriptor: string | null, merchant: string | null): MerchantPolicy | null {
  for (const text of [descriptor, merchant]) {
    if (!text) continue;
    const upper = text.toUpperCase();
    const hit = MERCHANT_POLICIES.find(m => m.descriptors.some(d => upper.includes(d.toUpperCase().replace(/\*$/, ''))));
    if (hit) return hit;
  }
  return null;
}

export function reasonCodesFor(caseType: CaseType): ReasonCode[] {
  return REASON_CODE_LIST.filter(c => c.caseTypes.includes(caseType));
}

// 카드 알림 문자에서 규칙으로 뽑을 수 있는 필드. LLM 추출보다 우선한다.
export type NotificationParse = {
  type: 'approved' | 'declined' | 'cancelled' | null;
  currency: string | null; amount: string | null; krw: string | null;
  date: string | null; time: string | null; descriptor: string | null; issuer: string | null; suspicious: boolean;
};

export function parseNotification(text: string): NotificationParse {
  const p = patternsJson.patterns;
  const re = (s: string, flags = '') => new RegExp(s, flags);
  const typeMatch = text.match(re(p.type));
  const typeKeys = Object.keys(patternsJson.typeMap).sort((a, b) => b.length - a.length);
  const typeKey = typeMatch ? typeKeys.find(k => typeMatch[0] === k) ?? typeKeys.find(k => typeMatch[0].startsWith(k)) : undefined;
  const amount = text.match(re(p.foreignAmount));
  const krw = text.match(re(p.krwAmount));
  const dt = text.match(re(p.dateTime));
  const issuer = text.match(re(p.issuer));
  const lines = text.split(/\n|\s{2,}/).map(l => l.trim()).filter(Boolean);
  let descriptor: string | null = null;
  for (const line of lines) {
    // 금액·일시·발신 표기를 지우고, 한글 토큰(카드사명, 승인 유형, 님, 일시불, 원)과 숫자 토큰을 걷어내면 가맹점 표기만 남는다.
    const cleaned = line
      .replace(re(p.foreignAmount, 'g'), ' ')
      .replace(re(p.dateTime, 'g'), ' ')
      .replace(/\[(Web|웹|국외|국제)발신\]/g, ' ')
      .replace(/\S*[ㄱ-힝]\S*/g, ' ')
      .replace(/(^|\s)[\d,.:/]+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned && re(p.descriptorLine).test(cleaned)) { descriptor = cleaned; break; }
  }
  return {
    type: typeKey ? (patternsJson.typeMap as Record<string, NotificationParse['type']>)[typeKey] : null,
    currency: amount ? amount[1] : null,
    amount: amount ? amount[2] : null,
    krw: krw ? krw[1] : null,
    date: dt ? `${dt[1].padStart(2, '0')}/${dt[2].padStart(2, '0')}` : null,
    time: dt ? `${dt[3].padStart(2, '0')}:${dt[4]}` : null,
    descriptor,
    issuer: issuer ? issuer[0] : null,
    suspicious: re(p.suspiciousHeader).test(text),
  };
}

// 추출 결과를 규칙 파싱으로 보정한다. 문자에서 확실히 읽힌 값이 있으면 그것을 쓴다.
export function reconcileWithNotification(parsed: Parsed, notificationText: string): Parsed {
  const n = parseNotification(notificationText);
  const out = { ...parsed };
  if (n.descriptor && !out.descriptor) out.descriptor = n.descriptor;
  if (n.currency && n.amount && !out.amount) out.amount = `${n.currency} ${n.amount}`;
  if (n.type === 'declined' && out.paymentStatus === 'unknown') out.paymentStatus = 'declined';
  if (n.type === 'approved' && out.paymentStatus === 'unknown') out.paymentStatus = 'approved';
  return out;
}
