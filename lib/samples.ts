import { combineSlots, deadlineFor, type CaseResult, type Parsed, type Report, type Slots } from './case';
import { searchRules, verifySender } from './rules';
import { buildReferences } from './references';

export type Sample = { id: string; label: string; caption: string; slots: Slots; text: string; result: CaseResult };

function sample(id: string, label: string, caption: string, slots: Slots, parsed: Parsed, report: Report): Sample {
  return {
    id, label, caption, slots,
    text: combineSlots(slots),
    result: { parsed, report, rules: searchRules(parsed.caseType), references: buildReferences(parsed), verification: verifySender(parsed.senderDomain), deadline: deadlineFor(parsed.paymentStatus), mode: 'demo' },
  };
}

const routes: Report['routes'] = [
  { name: 'merchant', title: '사업자에게 확인 요청', note: '청구 근거와 처리 내역을 한 번에 정리해서 물어보세요.', missing: ['사업자 답장', '계약·요금제 화면'] },
  { name: 'issuer', title: '카드사 상담 준비', note: '거래 상태와 접수 요건을 카드사에 물어보세요.', missing: ['매입 내역', '카드사 접수 양식'] },
  { name: 'kca', title: '소비자상담 검토', note: '개인용인지 사업용인지, 국제거래 상담 대상인지 먼저 확인해요.', missing: ['계약 주체 확인'] },
];

const SUB_FACTS = [
  { label: '해지 요청', value: '8월 20일 · 해지 요청 완료', quote: '2026년 8월 20일 AlphaWrite 계정에서 구독 해지를 요청했습니다. 해지 요청 화면을 보관했습니다.' },
  { label: '카드 거래', value: '9월 1일 · 29달러 매입', quote: '카드 앱 매입 내역에 2026년 9월 1일 ALPHAWRITE USD 29.00이 있습니다.' },
  { label: '사업자 문의', value: '9월 2일 · 답변 대기', quote: '2026년 9월 2일 고객센터에 문의했습니다. 아직 답변이 없습니다. 개인용 월간 구독입니다.' },
];
const DUP_FACTS = [
  { label: '주문 내역', value: '주문 한 건 · 49달러', quote: '2026년 9월 3일 BetaDesign에서 49달러 상품을 한 번 주문했습니다.' },
  { label: '결제 알림', value: '같은 금액의 알림 2건', quote: '카드 승인 문자에 BETADESIGN USD 49.00이 두 번 표시됩니다. 매입 내역은 아직 확인하지 않았습니다.' },
];
const KEY_FACTS = [
  { label: '청구서', value: '12,000달러 · 평소 월 40달러', quote: '2026년 9월 4일 GammaAI에서 12,000달러 API 사용량 청구서를 받았습니다. 지난달까지는 월 40달러 정도였고 이번 달은 제가 쓰지 않은 사용량입니다.' },
  { label: '카드 알림', value: '승인 거절 반복 · 매입 없음', quote: '카드 앱에 9월 4일과 5일 STRIPE *GAMMAAI USD 12,000.00 승인 거절이 표시됩니다. 매입 내역은 확인하지 못했습니다.' },
  { label: '키 조치', value: '9월 5일 · 키 삭제 후 재발급', quote: '2026년 9월 5일 GammaAI 콘솔에서 API 키를 삭제하고 새로 발급했습니다. 사용량 대시보드에는 9월 2일부터 해외 IP 요청이 급증한 기록이 있습니다.' },
];

export const SAMPLES: Sample[] = [
  sample('subscription', '해지했는데 또 결제됐어요', 'AI 글쓰기 구독 · USD 29 매입', {
    sms: '[Web발신] 해외승인 ALPHAWRITE USD 29.00 09/01 10:12 일시불',
    mail: '',
    note: SUB_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: '해지 후에도 이어진 구독 결제',
    summary: 'AlphaWrite 구독 해지를 요청했는데 29달러가 청구(매입)됐어요. 해지가 적용된 날과 이번 청구가 어느 기간 요금인지 맞춰 봐야 해요.',
    merchant: 'AlphaWrite', descriptor: 'ALPHAWRITE', caseType: 'cancelled_recurring', paymentStatus: 'posted', amount: 'USD 29.00', transactionDate: '2026-09-01', senderDomain: null,
    signals: [{ kind: 'post_cancel', evidence: '구독 해지를 요청했습니다' }],
    facts: SUB_FACTS,
  }, {
    headline: '해지가 언제 적용됐는지가 마지막 퍼즐이에요',
    explanation: '해지 요청 기록과 실제 청구는 확인됐어요. 구독이 언제 끝나는지 알면 이번 청구가 맞는 건지 설명할 수 있어요.',
    questions: [{ question: '구독이 언제 끝난다는 확인 메일이 있나요?', why: '해지를 요청한 날과 실제로 끝나는 날은 다를 수 있어요.' }, { question: '29달러는 어느 기간 요금인가요?', why: '해지 뒤 기간에 대한 청구인지 확인해요.' }],
    actions: [
      { title: '해지 확인 메일 찾기', description: '끝나는 날짜가 적힌 메일이나 계정 화면을 찾아 주세요.', urgency: 'today', sourceId: 'subscription' },
      { title: '청구 기간 물어보기', description: '사업자에게 해지 적용일과 이번 청구 기간을 같이 물어보세요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '카드사 접수 요건 확인하기', description: '매입 내역과 해지 기록을 준비해서 상담해요.', urgency: 'next', sourceId: 'visa-disputes' },
    ],
    routes,
    basis: [
      { refId: 'code:visa:13.2', point: '해지 요청 뒤 이어진 정기 청구는 Visa 13.2 취소된 정기결제 유형이에요. 기한은 거래 처리일로부터 120일이에요.' },
      { refId: 'subscription', point: '해지 요청일과 적용일이 다를 수 있어서, 끝나는 날짜 확인이 청구가 맞는지 판단하는 출발점이에요.' },
      { refId: 'authority:kca-chargeback-guide', point: '가맹점과 먼저 해결해 보려 한 메일 기록이 차지백 입증서류로 필요해요.' },
    ],
    drafts: {
      email: 'Subject: Request to review a charge after cancellation - AlphaWrite\n\nHello Billing Team,\n\nI requested cancellation on August 20, 2026. My card statement shows a USD 29.00 charge on September 1, 2026. I contacted support on September 2 and am awaiting a response.\n\nPlease confirm the effective cancellation date and the service period covered by this charge. If the charge was made in error, please advise on correcting it.\n\nI can provide my cancellation request and transaction record.\n\nThank you,\n[Your name]\n[Account email]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: AlphaWrite\n거래: 2026-09-01, USD 29.00, 매입 내역 확인\n\n2026-08-20: 구독 해지 요청\n2026-09-01: 카드 매입 내역 확인\n2026-09-02: 사업자 고객센터 문의, 답변 대기\n\n확인 필요: 해지 효력일, 청구 대상 기간\n보유 자료: 해지 요청 화면, 카드 매입 내역\n\n위 사실에 따른 상담 및 접수 요건 안내를 요청합니다. 접수 전 카드사 양식을 확인하겠습니다.\n신청인: [직접 입력]',
      timeline: '2026-08-20  구독 해지 요청\n2026-09-01  USD 29.00 매입\n2026-09-02  사업자 문의 · 답변 대기',
    },
  }),

  sample('duplicate', '같은 금액이 두 번 찍혔어요', '디자인 도구 주문 · USD 49 승인 2건', {
    sms: '[Web발신] 해외승인 BETADESIGN USD 49.00 09/03 21:40 일시불\n[Web발신] 해외승인 BETADESIGN USD 49.00 09/03 21:41 일시불',
    mail: '',
    note: DUP_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: '두 건으로 보이는 결제 내역',
    summary: 'BetaDesign 주문은 한 건인데 49달러 승인 알림이 두 번 왔어요. 승인 알림만 겹친 건지 실제로 두 번 청구된 건지는 아직 몰라요.',
    merchant: 'BetaDesign', descriptor: 'BETADESIGN', caseType: 'duplicate', paymentStatus: 'approved', amount: 'USD 49.00 × 2?', transactionDate: '2026-09-03', senderDomain: null,
    signals: [{ kind: 'duplicate', evidence: 'BETADESIGN USD 49.00이 두 번 표시됩니다' }],
    facts: DUP_FACTS,
  }, {
    headline: '알림이 두 번 왔다고 두 번 결제된 건 아니에요',
    explanation: '실제 매입 내역을 확인한 뒤에 중복인지 판단해요. 승인만 두 번 잡힌 거라면 며칠 안에 하나는 자동으로 풀려요.',
    questions: [{ question: '카드 앱에도 매입 두 건이 따로 있나요?', why: '승인 알림과 실제 매입은 달라요.' }],
    actions: [
      { title: '매입 내역 확인하기', description: '카드 앱에서 거래별 상태와 번호를 확인해요.', urgency: 'today', sourceId: 'visa-disputes' },
      { title: '주문 확인서 남기기', description: '수량과 금액이 보이는 화면을 저장해 두세요.', urgency: 'today', sourceId: 'kca-evidence' },
    ],
    routes,
    basis: [
      { refId: 'code:visa:12.6.1', point: '승인 알림 두 건과 매입 두 건은 달라요. Visa 12.6.1 중복 처리는 매입 내역 두 건이 있어야 해요.' },
      { refId: 'authority:fss-2026-06-card-complaints', point: '카드사 이의제기는 증빙을 모은 뒤 90~120일 안에 해야 해서, 매입이 확정되면 바로 준비해요.' },
    ],
    drafts: {
      email: 'Subject: Please verify possible duplicate billing\n\nHello BetaDesign,\nI placed one USD 49.00 order on September 3, 2026, but received two card authorization notifications. I have not yet confirmed whether both transactions were posted.\nPlease check the transactions associated with my order and confirm whether one of them will be released or refunded.\n\n[Your name]\nDraft for review.',
      statement: '상담용 검토 초안\nBetaDesign 주문 1건에 USD 49.00 승인 알림 2건을 받았습니다. 실제 매입 수는 미확인입니다. 거래 상태 확인을 요청합니다.\n신청인: [직접 입력]',
      timeline: '2026-09-03  주문 한 건 · 승인 알림 두 건\n매입 상태 확인 필요',
    },
  }),

  sample('apikey', 'API 키가 유출된 것 같아요', 'AI API 사용량 · USD 12,000 청구서', {
    sms: '[Web발신] 해외승인거절 STRIPE *GAMMAAI USD 12,000.00 09/04 14:02\n[Web발신] 해외승인거절 STRIPE *GAMMAAI USD 12,000.00 09/05 09:15',
    mail: 'From: billing@gammaai.example\nSubject: Your GammaAI invoice for usage Aug 25 – Sep 3\n\nInvoice total: USD 12,000.00\nPayment method: card on file - payment failed, we will retry automatically.',
    note: KEY_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: '키 유출 의심 고액 사용량 청구',
    summary: 'GammaAI에서 평소의 300배인 12,000달러 API 사용량 청구서가 왔어요. 내가 쓴 게 아니고, 키는 지웠고 카드 승인은 거절되고 있어요. 실제 청구(매입)는 아직 없어요.',
    merchant: 'GammaAI', descriptor: 'STRIPE *GAMMAAI', caseType: 'credential_theft', paymentStatus: 'declined', amount: 'USD 12,000.00', transactionDate: '2026-09-04', senderDomain: 'gammaai.example',
    signals: [
      { kind: 'spike', evidence: '지난달까지는 월 40달러 정도였고' },
      { kind: 'unauthorized_usage', evidence: '제가 쓰지 않은 사용량입니다' },
      { kind: 'retry_declined', evidence: '9월 4일과 5일 STRIPE *GAMMAAI USD 12,000.00 승인 거절' },
    ],
    facts: KEY_FACTS,
  }, {
    headline: '지혈은 끝났어요. 이제 사업자 검토를 열 차례예요',
    explanation: '키를 지웠고 승인도 거절돼서 돈이 더 나갈 일은 막혔어요. 실제 청구(매입)가 없으니 카드사 이의신청 대상은 아직 아니고, 사업자의 미승인 사용 검토가 환불로 가는 실제 길이에요. 카드가 도용된 게 아니라서 카드 도용 사유코드는 맞지 않아요.',
    questions: [
      { question: '급증한 구간의 요청 출처(IP·지역)가 대시보드에 남아 있나요?', why: '내가 쓴 게 아니라는 걸 보여주는 가장 직접적인 자료예요.' },
      { question: '키가 공개 저장소나 앱 코드에 들어 있었나요?', why: '어디서 샜는지 알면 검토가 빨라지고 다시 새는 걸 막아요.' },
    ],
    actions: [
      { title: '급증 구간 사용량 로그 내보내기', description: '9월 2일부터 요청 수, 출처 IP, 모델별 사용량을 파일로 저장해요.', urgency: 'now', sourceId: 'cloud-budget' },
      { title: '검토 요청에 키 삭제 시각 첨부하기', description: '9월 5일 키 삭제·재발급 화면과 평소 월 40달러 사용 내역을 함께 보내요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '카드사에 반복 승인 시도 차단 상담하기', description: '매입 전이어도 이 가맹점 결제를 막아 달라고 할 수 있어요.', urgency: 'today', sourceId: 'visa-disputes' },
    ],
    routes: routes.map(r => r.name === 'issuer' ? { ...r, title: '추가 결제 막기 상담', note: '승인이 거절돼도 반복 시도 대응은 카드사에 상담할 수 있어요. 매입이 생기면 그때 접수 요건을 확인해요.' } : r),
    basis: [
      { refId: 'code:visa:10.4', point: 'API 키 도용은 카드 정보 도용이 아니라서 Visa 10.4 같은 카드 도용 사유코드에 맞지 않는 경우가 많아요.' },
      { refId: 'merchant:stripe', point: '카드 표기 STRIPE *GAMMAAI는 결제대행 표기예요. 환불은 Stripe가 아니라 실제 판매자 GammaAI에 요청해야 해요.' },
      { refId: 'cloud-budget', point: '알림만 오는 예산은 사용량을 막지 못해서 키 삭제와 한도 설정이 따로 필요해요.' },
      { refId: 'authority:fss-2026-06-card-complaints', point: '매입이 없어 카드사 이의제기 대상은 아직 아니지만, 매입이 생기면 90~120일 기한이 시작돼요.' },
    ],
    drafts: {
      email: 'Subject: Request to review unauthorized API usage - invoice of USD 12,000\n\nHello GammaAI Billing,\n\nOn September 4, 2026 I received an invoice for USD 12,000 in API usage. My usage has been about USD 40 per month, and I did not generate this usage. The usage dashboard shows a spike in requests from foreign IP addresses starting September 2.\n\nOn September 5, 2026 I deleted the affected API key and issued a new one. Card authorizations for this invoice on September 4 and 5 were declined.\n\nPlease review this usage as unauthorized, provide the request logs for the period, and pause further payment attempts while the review is open.\n\nI can provide the key deletion record and my previous usage history.\n\nThank you,\n[Your name]\n[Account email]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: GammaAI (카드 표기 STRIPE *GAMMAAI)\n청구: 2026-09-04, USD 12,000.00 청구서. 카드 승인은 9월 4일·5일 거절. 매입 없음.\n\n2026-09-02: 사용량 대시보드에 해외 IP 요청 급증 시작\n2026-09-04: 청구서 수신 · 승인 거절\n2026-09-05: 승인 거절 반복 · API 키 삭제 및 재발급\n\n평소 사용량: 월 USD 40 수준\n요청: 해당 가맹점 반복 승인 시도 차단 상담. 매입 발생 시 접수 요건 안내.\n신청인: [직접 입력]',
      timeline: '2026-09-02  해외 IP 요청 급증 시작\n2026-09-04  USD 12,000 청구서 수신 · 승인 거절\n2026-09-05  승인 거절 반복 · API 키 삭제·재발급',
    },
  }),
];
