import { combineSlots, deadlineFor, type CaseResult, type Parsed, type Report, type Slots } from './case';
import { searchRules, verifySender } from './rules';
import { buildReferences } from './references';
import { ISSUERS } from './knowledge';

export type Sample = { id: string; label: string; caption: string; issuerId: string; slots: Slots; text: string; result: CaseResult };

function sample(id: string, label: string, caption: string, issuerId: string, slots: Slots, parsed: Parsed, report: Report): Sample {
  const issuer = ISSUERS.find(i => i.id === issuerId) ?? null;
  return {
    id, label, caption, issuerId, slots,
    text: combineSlots(slots),
    result: { parsed, report, rules: searchRules(parsed.caseType), references: buildReferences(parsed, issuer), verification: verifySender(parsed.senderDomain), deadline: deadlineFor(parsed.paymentStatus), mode: 'demo' },
  };
}

const routes: Report['routes'] = [
  { name: 'merchant', title: '사업자에게 확인 요청', note: '청구 근거와 처리 내역을 한 번에 정리해서 물어보세요.', missing: ['사업자 답장', '계약·요금제 화면'] },
  { name: 'issuer', title: '카드사 상담 준비', note: '거래 상태와 접수 요건을 카드사에 물어보세요.', missing: ['매입 내역', '카드사 접수 양식'] },
  { name: 'kca', title: '소비자상담 검토', note: '개인용인지 사업용인지, 국제거래 상담 대상인지 먼저 확인해요.', missing: ['계약 주체 확인'] },
];

// 예시 1: Claude Pro 이용자가 동의 없이 Max 요금제로 바뀌어 200달러가 청구된 사례.
// 2026년 4~6월 GitHub anthropics/claude-code 이슈(#51404, #66426, #64814 등)에 반복 보고된 유형을 바탕으로 구성.
const CLAUDE_FACTS = [
  { label: '내 요금제', value: 'Claude Pro · 월 20달러', quote: '저는 Claude Pro 월 20달러 요금제를 쓰고 있었고, 8월 30일에 정상적으로 20달러가 갱신됐습니다.' },
  { label: '카드 결제', value: '9월 2일 · 200달러 매입', quote: '카드 앱 매입 내역에 2026년 9월 2일 ANTHROPIC USD 200.00이 있습니다.' },
  { label: '청구 메일', value: 'Max 20x 요금제로 표시', quote: '9월 2일 billing@anthropic.com에서 온 영수증에는 "Claude Max 20x monthly"라고 적혀 있습니다. 저는 업그레이드를 누른 적이 없습니다.' },
  { label: '환불 요청', value: '9월 3일 · 봇 답변만 받음', quote: '9월 3일 계정의 Get help 메신저로 환불을 요청했는데 자동 응답만 오고 사람 답변은 없습니다.' },
];
const DUP_FACTS = [
  { label: '주문 내역', value: '주문 한 건 · 49달러', quote: '2026년 9월 3일 BetaDesign에서 49달러 상품을 한 번 주문했습니다.' },
  { label: '결제 알림', value: '같은 금액의 알림 2건', quote: '카드 승인 문자에 BETADESIGN USD 49.00이 두 번 표시됩니다. 매입 내역은 아직 확인하지 않았습니다.' },
];
// 예시 3: GitHub에 올라간 AWS 액세스 키가 도용돼 다른 리전에 서버가 대량 생성된 사례.
// AWS re:Post와 국내 블로그에 반복 보고된 유형(키 유출 → 채굴용 인스턴스 → 수백만 원 청구 → Support 케이스로 조정)을 바탕으로 구성.
const AWS_FACTS = [
  { label: '키 유출', value: '9월 1일 · GitHub에 키 포함 커밋', quote: '9월 1일 개인 프로젝트를 GitHub 공개 저장소에 올렸는데, 설정 파일에 AWS 액세스 키가 들어 있었습니다.' },
  { label: '청구 알림', value: '9월 4일 · 예산 초과 메일', quote: '9월 4일 AWS Budgets에서 "이번 달 예상 요금 5,600달러"라는 메일을 받았습니다. 평소에는 월 15달러 정도 나옵니다.' },
  { label: '카드 승인', value: '9월 5일 · 5,619.11달러 승인', quote: '카드 승인 문자에 9월 5일 AMZN WEB SERVICES USD 5,619.11 해외승인이 찍혔습니다. 매입 내역에는 아직 안 보입니다.' },
  { label: '조치', value: '키 삭제 · 서버 정리 · MFA', quote: '9월 5일 콘솔에서 해당 액세스 키를 삭제하고, 프랑크푸르트 리전에 제가 만들지 않은 EC2 인스턴스 40여 대를 종료했습니다. 루트 계정에 MFA를 켰습니다.' },
];

export const SAMPLES: Sample[] = [
  sample('claude', 'Claude Pro인데 200달러가 결제됐어요', 'Claude 구독 · 요금제가 멋대로 바뀜', 'shinhan', {
    sms: '[Web발신] 신한카드 해외승인 ANTHROPIC USD 200.00 09/02 09:14 일시불',
    mail: 'From: billing@anthropic.com\nSubject: Your receipt from Anthropic\n\nClaude Max 20x monthly\nAmount paid: USD 200.00\nDate: September 2, 2026',
    note: CLAUDE_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: 'Claude Pro인데 200달러가 결제됐어요',
    summary: 'Claude Pro(월 20달러)를 쓰고 있는데 9월 2일에 200달러가 결제됐고, 영수증에는 Max 20x 요금제라고 적혀 있어요. 본인은 업그레이드한 적이 없어요.',
    merchant: 'Anthropic (Claude)', descriptor: 'ANTHROPIC', caseType: 'billing_error', paymentStatus: 'posted', amount: 'USD 200.00', transactionDate: '2026-09-02', senderDomain: 'anthropic.com',
    signals: [{ kind: 'spike', evidence: '월 20달러 요금제를 쓰고 있었고' }],
    facts: CLAUDE_FACTS,
  }, {
    headline: 'Claude Pro인데 200달러가 결제됐어요',
    explanation: '약속한 요금은 월 20달러인데 200달러가 카드사에서 확정됐어요. 지금 할 일은 Anthropic 환불 요청 메뉴에서 "동의 없는 요금제 변경"으로 환불을 요청하고, 그 화면을 캡처해 두는 거예요.',
    questions: [
      { question: '계정 설정 > Billing 화면에 지금 요금제가 Max로 표시되나요?', why: '요금제 변경이 서버 쪽에서 일어났다는 걸 보여 주는 화면이 돼요.' },
      { question: '9월 2일 전후로 "요금제가 변경됐다"는 메일이 따로 왔나요?', why: '본인이 누른 기록이 없다는 걸 메일 흐름으로 보일 수 있어요.' },
    ],
    actions: [
      { title: 'Billing 화면과 영수증 캡처하기', description: '현재 요금제 표시, 9월 2일 영수증, 8월 30일 20달러 영수증을 함께 저장해요.', urgency: 'now', sourceId: 'kca-evidence' },
      { title: '환불 요청에 "Pro만 선택했다"는 사실 적기', description: '요청 화면에서 사유를 고르고, 8월 30일 정상 갱신 내역을 근거로 붙여요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '답이 없으면 카드사 금액 오류 사유로 준비하기', description: '약정 20달러와 청구 200달러가 다르다는 자료로 접수 요건을 상담해요.', urgency: 'next', sourceId: 'visa-disputes' },
    ],
    routes,
    basis: [
      { refId: 'code:visa:12.5', point: '약속한 요금제(20달러)와 실제 청구(200달러)가 다른 경우는 Visa 12.5 금액 불일치 유형이에요. 약정 금액이 보이는 화면이 필요해요.' },
      { refId: 'merchant:anthropic', point: 'Anthropic은 환불 요청을 계정의 Get help 메신저로 받고, 환불을 받아도 구독은 따로 해지해야 해요.' },
      { refId: 'authority:kca-chargeback-guide', point: '카드사 이의신청 전에 사업자에게 먼저 해결을 요청한 기록이 필요해요.' },
    ],
    drafts: {
      email: 'Subject: Refund request - unauthorized plan change from Pro to Max (USD 200.00 on Sep 2, 2026)\n\nHello Anthropic Support,\n\nI am on the Claude Pro plan (USD 20/month), which renewed normally on August 30, 2026. On September 2, 2026 my card was charged USD 200.00 and the receipt shows "Claude Max 20x monthly". I did not select or confirm any upgrade.\n\nPlease refund the USD 200.00 charge and restore my plan to Pro. I have attached the two receipts and a screenshot of my billing page.\n\nIf this cannot be resolved, I will need to raise the charge with my card issuer as an incorrect amount.\n\nThank you,\n[Your name]\n[Account email]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: Anthropic (Claude)\n거래: 2026-09-02, USD 200.00, 매입 내역 확인\n약정 요금제: Claude Pro 월 USD 20 (2026-08-30 정상 갱신)\n\n2026-08-30: Pro 요금제 USD 20 갱신\n2026-09-02: USD 200.00 결제, 영수증에 Max 20x 표시. 업그레이드 선택 기록 없음\n2026-09-03: 사업자 환불 요청, 자동 응답만 수신\n\n확인 필요: 사업자 환불 처리 여부\n보유 자료: 8월 30일·9월 2일 영수증, Billing 화면 캡처, 환불 요청 화면\n\n위 사실에 따른 상담 및 접수 요건 안내를 요청합니다.\n신청인: [직접 입력]',
      timeline: '2026-08-30  Claude Pro USD 20 정상 갱신\n2026-09-02  USD 200.00 결제 · 영수증 Max 20x\n2026-09-03  사업자 환불 요청 · 자동 응답',
    },
  }),

  sample('duplicate', '같은 금액이 두 번 찍혔어요', '디자인 도구 주문 · USD 49 승인 2건', 'kb', {
    sms: '[Web발신] KB국민카드 해외승인 BETADESIGN USD 49.00 09/03 21:40 일시불\n[Web발신] KB국민카드 해외승인 BETADESIGN USD 49.00 09/03 21:41 일시불',
    mail: '',
    note: DUP_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: '49달러 승인이 두 번 잡혔어요',
    summary: 'BetaDesign 주문은 한 건인데 49달러 승인 알림이 두 번 왔어요. 승인 알림만 겹친 건지 실제로 두 번 청구된 건지는 아직 몰라요.',
    merchant: 'BetaDesign', descriptor: 'BETADESIGN', caseType: 'duplicate', paymentStatus: 'approved', amount: 'USD 49.00 × 2?', transactionDate: '2026-09-03', senderDomain: null,
    signals: [{ kind: 'duplicate', evidence: 'BETADESIGN USD 49.00이 두 번 표시됩니다' }],
    facts: DUP_FACTS,
  }, {
    headline: '49달러 승인이 두 번 잡혔어요',
    explanation: '아직은 승인 알림만 두 번이고, 실제로 두 번 청구됐는지는 확인이 안 됐어요. 먼저 카드 앱에서 두 건이 모두 확정됐는지 확인해 주세요.',
    questions: [{ question: '카드 앱에도 매입 두 건이 따로 있나요?', why: '승인만 두 번이면 며칠 안에 하나는 자동으로 풀려요. 두 건 다 확정됐을 때만 이의신청 대상이에요.' }],
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

  sample('aws', 'AWS 키가 유출돼 5,600달러가 나왔어요', 'AWS 클라우드 · 남이 만든 서버 요금', 'samsung', {
    sms: '[Web발신] 삼성카드 해외승인 AMZN WEB SERVICES USD 5,619.11 09/05 03:12 일시불',
    mail: 'From: no-reply@aws.amazon.com\nSubject: AWS Budgets: Monthly budget has exceeded your alert threshold\n\nBudgeted amount: USD 20.00\nForecasted amount: USD 5,600.00\nTop services: Amazon EC2 (eu-central-1)',
    note: AWS_FACTS.map(f => f.quote).join('\n'),
  }, {
    title: 'AWS 키가 유출돼 5,600달러가 나왔어요',
    summary: 'GitHub에 올린 코드에 AWS 액세스 키가 들어 있었고, 누군가 그 키로 프랑크푸르트 리전에 서버 40여 대를 만들었어요. 평소 월 15달러인데 5,619달러 승인이 잡혔고, 키는 지웠어요.',
    merchant: 'Amazon Web Services', descriptor: 'AMZN WEB SERVICES', caseType: 'credential_theft', paymentStatus: 'approved', amount: 'USD 5,619.11', transactionDate: '2026-09-05', senderDomain: 'aws.amazon.com',
    signals: [
      { kind: 'spike', evidence: '평소에는 월 15달러 정도 나옵니다' },
      { kind: 'unauthorized_usage', evidence: '제가 만들지 않은 EC2 인스턴스 40여 대' },
    ],
    facts: AWS_FACTS,
  }, {
    headline: 'AWS 키가 도용돼 5,619달러 승인이 잡혔어요',
    explanation: '키는 지웠고 서버도 정리했지만 5,619달러 승인은 잡혀 있고 며칠 안에 확정될 수 있어요. 지금 할 일은 AWS Support에 "계정 도용" 케이스를 열어 요금 조정을 요청하는 거예요. 카드가 도용된 게 아니라서 카드사 이의신청보다 이 경로가 먼저예요.',
    questions: [
      { question: 'CloudTrail이나 콘솔에서 서버가 만들어진 시각과 출처 IP를 볼 수 있나요?', why: '내가 만든 게 아니라는 걸 보여 주는 가장 직접적인 자료예요. AWS도 이걸 확인해요.' },
      { question: '만들어졌던 리소스를 모두 지웠나요(EC2 외에 S3, MediaLive 등)?', why: '남아 있는 리소스가 있으면 요금이 계속 늘고, AWS는 정리를 확인한 뒤 조정을 검토해요.' },
    ],
    actions: [
      { title: 'AWS Support 케이스 열기(Account and billing)', description: '"Unauthorized activity" 유형으로 열고, 키 삭제 시각과 종료한 인스턴스 목록을 적어요. 이 유형은 무료 플랜에서도 열 수 있어요.', urgency: 'now', sourceId: 'cloud-budget' },
      { title: 'CloudTrail에서 9월 1일 이후 활동 내보내기', description: '인스턴스 생성 시각, 출처 IP, 사용된 키 ID를 파일로 저장해요.', urgency: 'today', sourceId: 'kca-evidence' },
      { title: '카드사에 매입 확정 전 상담하기', description: '승인 상태에서 이의신청은 어렵지만, 확정되면 어떤 서류가 필요한지 미리 물어봐요.', urgency: 'next', sourceId: 'visa-disputes' },
    ],
    routes: routes.map(r => r.name === 'issuer' ? { ...r, title: '매입 확정 뒤 접수 준비', note: '지금은 승인 상태예요. 확정되면 AWS 답장과 CloudTrail 기록을 들고 접수 요건을 상담해요.' } : r),
    basis: [
      { refId: 'merchant:aws', point: 'AWS는 계정 도용 요금을 Support 케이스(Account and billing)에서 검토하고, 리소스 정리와 MFA 설정을 확인한 뒤 1회성 조정을 해 주는 경우가 많아요.' },
      { refId: 'code:visa:10.4', point: '액세스 키 도용은 카드 정보 도용이 아니라서 Visa 10.4 같은 카드 도용 사유코드에 맞지 않는 경우가 많아요.' },
      { refId: 'cloud-budget', point: '예산 알림은 요금이 생긴 뒤에 오는 거라, 키 삭제와 리소스 종료가 먼저예요.' },
      { refId: 'authority:fss-2026-06-card-complaints', point: '매입이 확정되면 카드사 이의제기 기한(90~120일)이 시작돼요. AWS 답장을 받는 동안 기한을 놓치지 않게 날짜를 적어 둬요.' },
    ],
    drafts: {
      email: 'Subject: Unauthorized usage from a leaked access key - request for billing adjustment\n\nHello AWS Support,\n\nOn September 1, 2026 an access key for my account was accidentally committed to a public GitHub repository. Between September 1 and September 5, about 40 EC2 instances I did not create were launched in eu-central-1. My usual monthly bill is about USD 15; the forecast for this month is about USD 5,600 and a card authorization of USD 5,619.11 appeared on September 5.\n\nOn September 5 I deleted the exposed access key, terminated all instances I did not create, and enabled MFA on the root account.\n\nPlease review this usage as unauthorized activity and adjust the charges. I can provide CloudTrail logs showing the source IPs and the key ID used.\n\nThank you,\n[Your name]\n[Account ID]\n\nDraft for review before sending.',
      statement: '카드사 상담용 사실관계 정리 · 검토 초안\n\n사업자: Amazon Web Services (카드 표기 AMZN WEB SERVICES)\n거래: 2026-09-05, USD 5,619.11 해외승인. 매입 확정 여부 확인 필요\n평소 사용량: 월 USD 15 수준\n\n2026-09-01: GitHub 공개 저장소에 액세스 키 포함 커밋\n2026-09-04: AWS 예산 초과 알림(예상 USD 5,600)\n2026-09-05: 카드 승인 USD 5,619.11 · 키 삭제 · 무단 생성 인스턴스 종료 · MFA 설정 · AWS Support 케이스 접수\n\n요청: 매입 확정 시 접수 요건 안내. 사업자 검토 결과를 받는 대로 제출 예정.\n신청인: [직접 입력]',
      timeline: '2026-09-01  GitHub에 액세스 키 노출\n2026-09-04  AWS 예산 초과 알림 · 예상 USD 5,600\n2026-09-05  USD 5,619.11 승인 · 키 삭제 · 서버 종료 · Support 케이스',
    },
  }),
];
