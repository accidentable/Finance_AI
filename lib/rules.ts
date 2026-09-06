export type CaseType = 'billing_error' | 'credential_theft' | 'cancelled_recurring' | 'duplicate' | 'not_received' | 'unknown';
export type Rule = { id: string; title: string; body: string; url: string; publisher: string; scope: string };
// 일반 안내 자료. 개별 카드사의 기한/사유코드를 확정하는 규칙이 아니다.
export const RULES: Rule[] = [
  { id: 'visa-disputes', title: '거래 상태와 분쟁 절차', body: '거래 내역과 사업자와의 소통 기록을 준비해 카드 발급사에 분쟁 절차를 확인합니다. 승인 알림과 실제 매입은 구분해야 합니다.', url: 'https://www.visa.com/en-us/support/business/dispute-resolution', publisher: 'Visa', scope: '일반 절차 · 개별 적용 확인 필요' },
  { id: 'kca-evidence', title: '사업자 회신도 중요한 증빙', body: '사업자와 해결을 시도한 메일·채팅, 거래 내역, 취소 확인 자료를 보존합니다. 소비자상담 대상 여부와 접수 요건은 별도로 확인합니다.', url: 'https://www.kca.go.kr/kca/sub.do?menukey=5293&mode=view&no=1002573197&page=29', publisher: '한국소비자원', scope: '과거 일반 안내 · 최신 기한 계산에 사용하지 않음' },
  { id: 'subscription', title: '해지 요청과 해지 완료의 차이', body: '계약 형태, 해지 효력일, 청구 대상 기간을 함께 확인합니다. 해지했다고 생각한 뒤에도 청구된 문제를 FTC가 다룬 바 있습니다. 한국 사건의 환불 권리를 확정하는 근거는 아닙니다.', url: 'https://consumer.ftc.gov/consumer-alerts/2024/05/adobe-used-hidden-fee-trap-people-paying-subscription-plans-ftc-says', publisher: '미국 FTC', scope: '해외 사례 · 국내 개별 적용 판단 아님' },
  { id: 'cloud-budget', title: '알림 예산과 지출 차단 구분', body: '알림 전용 예산은 사용량을 자동 차단하지 않습니다. 서비스별 Spend cap 제공 여부와 적용 범위를 확인해야 합니다.', url: 'https://docs.cloud.google.com/billing/docs/how-to/budgets', publisher: 'Google Cloud', scope: 'Google Cloud 설정 안내' },
];
export function searchRules(type: CaseType): Rule[] {
  return RULES.filter(r => r.id === 'visa-disputes' || r.id === 'kca-evidence' || (type === 'cancelled_recurring' && r.id === 'subscription') || (type === 'credential_theft' && r.id === 'cloud-budget'));
}
export function verifySender(sender: string | null) {
  const domain = sender?.trim().toLowerCase() || null;
  const match = domain && ['anthropic.com', 'openai.com', 'google.com', 'stripe.com'].some(d => domain === d || domain.endsWith('.' + d));
  return { domain, label: !domain ? '발신 정보 부족' : match ? '도메인 목록 일치' : '도메인 추가 확인', note: '발신 주소 대조만으로 진위를 인증할 수 없습니다. 공식 서비스에 직접 접속해 확인하세요.' };
}
