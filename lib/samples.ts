import { deadlineFor, type CaseResult, type Parsed, type Report } from './case';
import { searchRules, verifySender } from './rules';

export type Sample = { id: string; label: string; caption: string; text: string; result: CaseResult };

function sample(id: string, label: string, caption: string, parsed: Parsed, report: Report): Sample {
  return {
    id, label, caption,
    text: parsed.facts.map(f => f.quote).join('\n\n'),
    result: { parsed, report, rules: searchRules(parsed.caseType), verification: verifySender(parsed.senderDomain), deadline: deadlineFor(parsed.paymentStatus), mode: 'demo' },
  };
}

const routes: Report['routes'] = [
  { name: 'merchant', title: '사업자에 확인 요청', note: '청구 근거와 처리 내역을 같은 문의에 정리해 요청하세요.', missing: ['사업자 회신', '계약·요금제 화면'] },
  { name: 'issuer', title: '카드사 상담 준비', note: '거래 상태와 분쟁 접수 요건을 카드 발급사에 확인하세요.', missing: ['매입 내역', '카드사 접수 양식'] },
  { name: 'kca', title: '소비자상담 검토', note: '개인·사업용 계약 여부와 국제거래 상담 대상을 먼저 확인하세요.', missing: ['계약 주체 확인'] },
];

export const SAMPLES: Sample[] = [
  sample('subscription', '해지했는데 또 결제됐어요', 'AI 글쓰기 구독 · USD 29 매입', {
    title: '해지 후에도 이어진 구독 결제',
    summary: 'AlphaWrite 구독 해지를 요청한 뒤 29달러가 매입됐습니다. 해지 효력일과 이번 청구의 대상 기간을 연결해 확인해야 합니다.',
    merchant: 'AlphaWrite', descriptor: 'ALPHAWRITE', caseType: 'cancelled_recurring', paymentStatus: 'posted', amount: 'USD 29.00', transactionDate: '2026-09-01', senderDomain: null,
    signals: [{ kind: 'post_cancel', evidence: '구독 해지를 요청했습니다' }],
    facts: [
      { label: '해지 요청', value: '8월 20일 · 해지 요청 완료', quote: '2026년 8월 20일 AlphaWrite 계정에서 구독 해지를 요청했습니다. 해지 요청 화면을 보관했습니다.' },
      { label: '카드 거래', value: '9월 1일 · 29달러 매입', quote: '카드 앱 매입 내역에 2026년 9월 1일 ALPHAWRITE USD 29.00이 있습니다.' },
      { label: '사업자 문의', value: '9월 2일 · 답변 대기', quote: '2026년 9월 2일 고객센터에 문의했습니다. 아직 답변이 없습니다. 개인용 월간 구독입니다.' },
    ],
  }, {
    headline: '해지 효력일이 마지막 연결 고리예요',
    explanation: '요청 기록과 실제 매입은 확인했습니다. 구독이 언제 종료되는지 확인하면, 이번 청구와의 관계를 더 명확하게 설명할 수 있습니다.',
    questions: [{ question: '구독이 언제 종료된다는 확인 메일이 있나요?', why: '해지 요청일과 실제 종료일은 다를 수 있습니다.' }, { question: '29달러는 어느 기간의 이용 요금인가요?', why: '해지 이후 기간에 대한 청구인지 확인합니다.' }],
    actions: [
      { title: '해지 확인 메일 찾기', description: '종료일이 적힌 메일이나 계정 화면을 확인하세요.', urgency: 'today', sourceId: 'subscription' },
      { title: '청구 기간 확인 요청', description: '사업자에게 해지 효력일과 청구 대상 기간을 함께 물어보세요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '카드사 접수 요건 확인', description: '매입 내역과 해지 기록을 준비해 상담하세요.', urgency: 'next', sourceId: 'visa-disputes' },
    ],
    routes,
    drafts: {
      email: 'Subject: Request to review a charge after cancellation — AlphaWrite\n\nHello Billing Team,\n\nI requested cancellation on August 20, 2026. My card statement shows a USD 29.00 charge on September 1, 2026. I contacted support on September 2 and am awaiting a response.\n\nPlease confirm the effective cancellation date and the service period covered by this charge. If the charge was made in error, please advise on correcting it.\n\nI can provide my cancellation request and transaction record.\n\nThank you,\n[Your name]\n[Account email]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: AlphaWrite\n거래: 2026-09-01, USD 29.00, 매입 내역 확인\n\n2026-08-20: 구독 해지 요청\n2026-09-01: 카드 매입 내역 확인\n2026-09-02: 사업자 고객센터 문의, 답변 대기\n\n확인 필요: 해지 효력일, 청구 대상 기간\n보유 자료: 해지 요청 화면, 카드 매입 내역\n\n위 사실에 따른 상담 및 접수 요건 안내를 요청합니다. 접수 전 카드사 양식을 확인하겠습니다.\n신청인: [직접 입력]',
      timeline: '2026-08-20  구독 해지 요청\n2026-09-01  USD 29.00 매입\n2026-09-02  사업자 문의 · 답변 대기',
    },
  }),

  sample('duplicate', '같은 금액이 두 번 찍혔어요', '디자인 도구 주문 · USD 49 승인 2건', {
    title: '두 건으로 보이는 결제 내역',
    summary: 'BetaDesign 주문은 한 건인데 49달러 승인 알림이 두 번 도착했습니다. 승인 알림 중복인지 실제 매입 두 건인지 아직 확인되지 않았습니다.',
    merchant: 'BetaDesign', descriptor: 'BETADESIGN', caseType: 'duplicate', paymentStatus: 'approved', amount: 'USD 49.00 × 2?', transactionDate: '2026-09-03', senderDomain: null,
    signals: [{ kind: 'duplicate', evidence: 'BETADESIGN USD 49.00이 두 번 표시됩니다' }],
    facts: [
      { label: '주문 내역', value: '주문 한 건 · 49달러', quote: '2026년 9월 3일 BetaDesign에서 49달러 상품을 한 번 주문했습니다.' },
      { label: '결제 알림', value: '같은 금액의 알림 2건', quote: '카드 승인 문자에 BETADESIGN USD 49.00이 두 번 표시됩니다. 매입 내역은 아직 확인하지 않았습니다.' },
    ],
  }, {
    headline: '두 알림이 두 결제인지는 아직 몰라요',
    explanation: '실제 매입 내역을 확인한 뒤 중복 청구 여부를 검토합니다. 승인만 두 번 잡힌 경우 며칠 안에 하나가 자동 해제될 수 있습니다.',
    questions: [{ question: '카드 앱에도 별도 매입 두 건이 있나요?', why: '승인 알림과 매입 내역의 중복 표시를 구분합니다.' }],
    actions: [
      { title: '매입 내역 확인하기', description: '거래별 상태와 식별자를 카드 앱에서 확인하세요.', urgency: 'today', sourceId: 'visa-disputes' },
      { title: '주문 확인서 보관', description: '주문 수량과 금액이 보이는 화면을 보존하세요.', urgency: 'today', sourceId: 'kca-evidence' },
    ],
    routes,
    drafts: {
      email: 'Subject: Please verify possible duplicate billing\n\nHello BetaDesign,\nI placed one USD 49.00 order on September 3, 2026, but received two card authorization notifications. I have not yet confirmed whether both transactions were posted.\nPlease check the transactions associated with my order and confirm whether one of them will be released or refunded.\n\n[Your name]\nDraft for review.',
      statement: '상담용 검토 초안\nBetaDesign 주문 1건에 USD 49.00 승인 알림 2건을 받았습니다. 실제 매입 수는 미확인입니다. 거래 상태 확인을 요청합니다.\n신청인: [직접 입력]',
      timeline: '2026-09-03  주문 한 건 · 승인 알림 두 건\n매입 상태 확인 필요',
    },
  }),

  sample('apikey', 'API 키가 유출된 것 같아요', 'AI API 사용량 · USD 12,000 청구서', {
    title: '키 유출 의심 고액 사용량 청구',
    summary: 'GammaAI에서 평소의 300배인 12,000달러 API 사용량 청구서를 받았습니다. 본인이 쓰지 않은 사용량이며, 키는 삭제했고 카드 승인은 거절되고 있습니다. 매입은 아직 없습니다.',
    merchant: 'GammaAI', descriptor: 'STRIPE *GAMMAAI', caseType: 'credential_theft', paymentStatus: 'declined', amount: 'USD 12,000.00', transactionDate: '2026-09-04', senderDomain: null,
    signals: [
      { kind: 'spike', evidence: '지난달까지는 월 40달러 정도였고' },
      { kind: 'unauthorized_usage', evidence: '제가 쓰지 않은 사용량입니다' },
      { kind: 'retry_declined', evidence: '9월 4일과 5일 STRIPE *GAMMAAI USD 12,000.00 승인 거절' },
    ],
    facts: [
      { label: '청구서', value: '12,000달러 · 평소 월 40달러', quote: '2026년 9월 4일 GammaAI에서 12,000달러 API 사용량 청구서를 받았습니다. 지난달까지는 월 40달러 정도였고 이번 달은 제가 쓰지 않은 사용량입니다.' },
      { label: '카드 알림', value: '승인 거절 반복 · 매입 없음', quote: '카드 앱에 9월 4일과 5일 STRIPE *GAMMAAI USD 12,000.00 승인 거절이 표시됩니다. 매입 내역은 확인하지 못했습니다.' },
      { label: '키 조치', value: '9월 5일 · 키 삭제 후 재발급', quote: '2026년 9월 5일 GammaAI 콘솔에서 API 키를 삭제하고 새로 발급했습니다. 사용량 대시보드에는 9월 2일부터 해외 IP 요청이 급증한 기록이 있습니다.' },
    ],
  }, {
    headline: '지혈은 끝났고, 이제 가맹점 검토를 여는 단계예요',
    explanation: '키 삭제와 승인 거절로 추가 출금은 막혀 있습니다. 매입이 없으므로 카드사 이의신청 대상은 아직 없고, 가맹점의 미승인 사용 검토가 환불의 실제 경로입니다. 카드 도용이 아니므로 카드 도용 사유코드는 맞지 않습니다.',
    questions: [
      { question: '급증 구간의 요청 출처(IP·지역)가 대시보드에 남아 있나요?', why: '본인 사용이 아님을 보이는 가장 직접적인 자료입니다.' },
      { question: '키가 공개 저장소나 클라이언트 코드에 있었나요?', why: '유출 경로를 알면 가맹점 검토가 빨라지고 재발을 막습니다.' },
    ],
    actions: [
      { title: '급증 구간 사용량 로그 내보내기', description: '9월 2일부터의 요청 수, 출처 IP, 모델별 사용량을 파일로 저장하세요.', urgency: 'now', sourceId: 'cloud-budget' },
      { title: '미승인 사용 검토 티켓에 키 삭제 시각 첨부', description: '9월 5일 키 삭제·재발급 화면과 평소 월 40달러 사용 내역을 함께 제출하세요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '카드사에 반복 승인 시도 차단 상담', description: '매입 전이라도 해당 가맹점 결제 차단을 요청할 수 있습니다.', urgency: 'today', sourceId: 'visa-disputes' },
    ],
    routes: routes.map(r => r.name === 'issuer' ? { ...r, title: '추가 결제 방지 상담', note: '승인 거절이어도 반복 시도 대응은 카드사에 상담할 수 있습니다. 매입이 생기면 그때 접수 요건을 확인합니다.' } : r),
    drafts: {
      email: 'Subject: Request to review unauthorized API usage — invoice of USD 12,000\n\nHello GammaAI Billing,\n\nOn September 4, 2026 I received an invoice for USD 12,000 in API usage. My usage has been about USD 40 per month, and I did not generate this usage. The usage dashboard shows a spike in requests from foreign IP addresses starting September 2.\n\nOn September 5, 2026 I deleted the affected API key and issued a new one. Card authorizations for this invoice on September 4 and 5 were declined.\n\nPlease review this usage as unauthorized, provide the request logs for the period, and pause further payment attempts while the review is open.\n\nI can provide the key deletion record and my previous usage history.\n\nThank you,\n[Your name]\n[Account email]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: GammaAI (카드 표기 STRIPE *GAMMAAI)\n청구: 2026-09-04, USD 12,000.00 청구서. 카드 승인은 9월 4일·5일 거절. 매입 없음.\n\n2026-09-02: 사용량 대시보드에 해외 IP 요청 급증 시작\n2026-09-04: 청구서 수신 · 승인 거절\n2026-09-05: 승인 거절 반복 · API 키 삭제 및 재발급\n\n평소 사용량: 월 USD 40 수준\n요청: 해당 가맹점 반복 승인 시도 차단 상담. 매입 발생 시 접수 요건 안내.\n신청인: [직접 입력]',
      timeline: '2026-09-02  해외 IP 요청 급증 시작\n2026-09-04  USD 12,000 청구서 수신 · 승인 거절\n2026-09-05  승인 거절 반복 · API 키 삭제·재발급',
    },
  }),
];
