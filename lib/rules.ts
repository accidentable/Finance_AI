export type CaseType = 'billing_error' | 'credential_theft' | 'cancelled_recurring' | 'duplicate' | 'not_received' | 'unknown';
export type Rule = { id: string; title: string; body: string; url: string; publisher: string; scope: string };

// 출처가 있는 일반 안내. 개별 카드사의 기한이나 사유코드를 확정하는 규칙은 아니다.
export const RULES: Rule[] = [
  { id: 'visa-disputes', title: '거래 상태와 분쟁 절차', body: '거래 내역과 사업자와 주고받은 기록을 챙겨서 카드사에 분쟁 절차를 물어봐요. 승인 알림과 실제 청구(매입)는 다르니 구분해 두세요.', url: 'https://www.visa.com/en-us/support/business/dispute-resolution', publisher: 'Visa', scope: '일반 절차 · 내 사건에 맞는지 확인 필요' },
  { id: 'kca-evidence', title: '사업자 답장도 중요한 증빙이에요', body: '사업자와 해결해 보려고 주고받은 메일·채팅, 거래 내역, 취소 확인 자료를 남겨 두세요. 소비자상담 대상인지와 접수 요건은 따로 확인해요.', url: 'https://www.kca.go.kr/kca/sub.do?menukey=5293&mode=view&no=1002573197&page=29', publisher: '한국소비자원', scope: '과거 안내 자료 · 현재 요건은 확인 필요' },
  { id: 'subscription', title: '해지 요청과 해지 완료는 달라요', body: '계약 형태, 해지가 적용되는 날, 청구 대상 기간을 같이 확인해요. 해지했다고 생각한 뒤에도 청구된 문제를 미국 FTC가 다룬 적이 있어요. 한국 사건의 환불 권리를 정하는 근거는 아니에요.', url: 'https://consumer.ftc.gov/consumer-alerts/2024/05/adobe-used-hidden-fees-and-cancellation-hurdles-trap-subscribers', publisher: '미국 FTC', scope: '해외 사례 · 참고용' },
  { id: 'cloud-budget', title: '알림 예산과 지출 차단은 달라요', body: '알림만 오는 예산은 사용량을 막지 못해요. 서비스마다 지출 한도(Spend cap)를 주는지, 어디까지 막아주는지 확인해야 해요.', url: 'https://docs.cloud.google.com/billing/docs/how-to/budgets', publisher: 'Google Cloud', scope: 'Google Cloud 설정 안내' },
];

export function searchRules(type: CaseType): Rule[] {
  return RULES.filter(r => r.id === 'visa-disputes' || r.id === 'kca-evidence' || (type === 'cancelled_recurring' && r.id === 'subscription') || (type === 'credential_theft' && r.id === 'cloud-budget'));
}

export function verifySender(sender: string | null) {
  const domain = sender?.trim().toLowerCase() || null;
  const match = domain && ['anthropic.com', 'openai.com', 'google.com', 'stripe.com'].some(d => domain === d || domain.endsWith('.' + d));
  return {
    domain,
    label: !domain ? '발신 정보 부족' : match ? '도메인 목록 일치' : '도메인 추가 확인',
    note: '보낸 주소만으로는 진짜인지 인증할 수 없어요. 메일 속 링크 대신 서비스에 직접 접속해서 확인해 주세요.',
  };
}
