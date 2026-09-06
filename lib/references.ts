// 사건에 맞는 규정·정책 조각을 모아 LLM 근거와 화면 인용으로 쓴다. LLM 없이 동작한다.
import { AUTHORITIES, KNOWLEDGE_ACCESSED, REASON_CODE_LIST, REASON_CODE_SOURCES, VERIFIED_LABEL, findMerchantPolicy, reasonCodesFor, type Issuer } from './knowledge';
import { searchRules } from './rules';
import type { Parsed, Reference } from './case';

const AUTHORITY_IDS = ['fss-2026-06-card-complaints', 'kca-chargeback-guide', 'kca-crossborder-portal'];
const clip = (s: string, n = 420) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function buildReferences(parsed: Parsed, issuer: Issuer | null = null): Reference[] {
  const refs: Reference[] = [];
  for (const r of searchRules(parsed.caseType)) {
    refs.push({ id: r.id, kind: 'rule', title: r.title, publisher: r.publisher, url: r.url, accessed: KNOWLEDGE_ACCESSED, text: clip(`${r.body} (${r.scope})`) });
  }
  const codes = reasonCodesFor(parsed.caseType);
  if (parsed.caseType === 'credential_theft') {
    for (const c of REASON_CODE_LIST.filter(c => c.code === '10.4' || c.code === '4837')) codes.push({ ...c, when: `해당 없음: ${c.when}` });
  }
  for (const c of codes) {
    refs.push({
      id: `code:${c.network}:${c.code}`, kind: 'code',
      title: `${c.network === 'visa' ? 'Visa' : 'Mastercard'} ${c.code} ${c.name}`,
      publisher: c.network === 'visa' ? 'Visa 규정 (2차 정리)' : 'Mastercard 규정 (2차 정리)',
      url: REASON_CODE_SOURCES[c.network === 'visa' ? 0 : 1].url, accessed: REASON_CODE_SOURCES[0].accessed,
      text: clip(`기한: ${c.timeLimit}. 적용: ${c.when}. ${c.koreanNote} 증빙: ${c.evidence.join(', ') || '미기재'}. 가맹점 선행 접촉 ${c.merchantFirst ? '필요' : '불필요'}.`),
    });
  }
  const m = findMerchantPolicy(parsed.descriptor, parsed.merchant);
  if (m) {
    refs.push({
      id: `merchant:${m.id}`, kind: 'merchant', title: `${m.name} 환불·해지 정책`, publisher: m.name,
      url: m.channels[0]?.url ?? m.sources[0].url, accessed: m.sources[0].accessed,
      text: clip(`환불: ${m.refund} 해지: ${m.cancellation} 미승인·오청구: ${m.unauthorized}${m.notes.length ? ' 유의: ' + m.notes.join(' ') : ''} (${VERIFIED_LABEL[m.verified]})`, 700),
    });
  }
  if (issuer) {
    refs.push({
      id: `issuer:${issuer.id}`, kind: 'issuer', title: `${issuer.name} 해외이용 이의신청 절차`, publisher: issuer.name,
      url: issuer.channels.find(c => c.url)?.url ?? issuer.sources[0].url, accessed: issuer.sources[0].accessed,
      text: clip(`기한: ${issuer.deadline}. 처리: ${issuer.processing}. 사유: ${issuer.reasons.join(', ') || '미기재'}. 서류: ${issuer.documents.join(', ') || '미기재'}. 채널: ${issuer.channels.map(c => c.label).join(' / ')}. (${VERIFIED_LABEL[issuer.verified]})`, 700),
    });
  }
  for (const a of AUTHORITIES.filter(a => AUTHORITY_IDS.includes(a.id))) {
    refs.push({ id: `authority:${a.id}`, kind: 'authority', title: a.title, publisher: a.publisher, url: a.sources[0].url, accessed: a.sources[0].accessed, text: clip(a.points.join(' '), 600) });
  }
  return refs;
}

export function findReference(refs: Reference[], id: string): Reference | undefined {
  return refs.find(r => r.id === id);
}
