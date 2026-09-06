import type { CaseType, Parsed, Report } from './case';

// 가맹점 표기(디스크립터) 해독 사전. 카드 문자에 찍히는 표기를 실제 서비스와 공식 창구로 연결한다.
export type Merchant = {
  id: string;
  name: string;
  category: string;
  usageBased: boolean;
  processor?: true;
  patterns: RegExp[];
  links: { label: string; url: string }[];
  note: string;
};

export const MERCHANTS: Merchant[] = [
  { id: 'openai', name: 'OpenAI (ChatGPT · API)', category: 'AI 구독 · API 사용량', usageBased: true, patterns: [/OPENAI/i, /CHATGPT/i],
    links: [{ label: '청구·환불 도움말', url: 'https://help.openai.com/en/collections/3943089-billing' }, { label: '미승인 청구 검토 요청', url: 'https://help.openai.com/en/articles/7242625-unauthorized-chatgpt-or-api-credit-purchase-charges-how-to-request-a-refund' }, { label: 'API 결제 설정', url: 'https://platform.openai.com/settings/organization/billing/overview' }],
    note: '키 유출이 의심되면 키를 비활성화가 아니라 삭제한 뒤 도움말 센터에서 청구 검토를 요청합니다. 구독과 API 크레딧은 별도 계정 항목입니다.' },
  { id: 'anthropic', name: 'Anthropic (Claude)', category: 'AI 구독 · API 사용량', usageBased: true, patterns: [/ANTHROPIC/i, /CLAUDE/i],
    links: [{ label: '고객 지원 센터', url: 'https://support.claude.com/' }, { label: '콘솔 결제 설정', url: 'https://console.anthropic.com/settings/billing' }],
    note: '콘솔에서 사용량과 키 목록을 확인하고, 청구 문의는 지원 센터 티켓으로 접수합니다.' },
  { id: 'google', name: 'Google (Cloud · Gemini · One)', category: '클라우드 · AI 구독', usageBased: true, patterns: [/GOOGLE/i, /GEMINI/i],
    links: [{ label: 'Cloud 결제 지원', url: 'https://cloud.google.com/support/billing' }, { label: '예산·알림 설정 안내', url: 'https://cloud.google.com/billing/docs/how-to/budgets' }],
    note: '알림 전용 예산은 사용량을 차단하지 않습니다. 예상 밖 청구는 결제 지원 케이스로 접수합니다.' },
  { id: 'aws', name: 'Amazon Web Services', category: '클라우드 사용량', usageBased: true, patterns: [/AMZN\s*WEB/i, /AMAZON\s*WEB/i, /\bAWS\b/i],
    links: [{ label: 'Support 케이스 열기', url: 'https://console.aws.amazon.com/support/home' }, { label: '청구 안내 문서', url: 'https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/' }, { label: '비용 이상 탐지 설정', url: 'https://docs.aws.amazon.com/cost-management/latest/userguide/manage-ad.html' }],
    note: '리소스를 먼저 정리·종료한 뒤 Billing 유형의 Support 케이스로 청구 검토를 요청합니다.' },
  { id: 'azure', name: 'Microsoft Azure', category: '클라우드 사용량', usageBased: true, patterns: [/MSFT/i, /MICROSOFT/i, /AZURE/i],
    links: [{ label: '비용 관리·청구 문서', url: 'https://learn.microsoft.com/azure/cost-management-billing/' }, { label: '지출 한도 안내', url: 'https://learn.microsoft.com/azure/cost-management-billing/manage/spending-limit' }],
    note: '구독 유형에 따라 지출 한도 제공 여부가 다릅니다. 포털의 도움말+지원에서 청구 문의를 접수합니다.' },
  { id: 'xai', name: 'xAI (Grok)', category: 'AI 구독 · API 사용량', usageBased: true, patterns: [/X\.AI/i, /\bXAI\b/i, /GROK/i],
    links: [{ label: '개발자 콘솔', url: 'https://console.x.ai/' }],
    note: '콘솔에서 결제 내역과 키를 확인하고 청구 문의를 접수합니다.' },
  { id: 'github', name: 'GitHub', category: '개발 도구 구독', usageBased: true, patterns: [/GITHUB/i],
    links: [{ label: '결제 문서', url: 'https://docs.github.com/billing' }],
    note: 'Actions·Codespaces 사용량과 Copilot 구독은 별도 항목입니다.' },
  { id: 'vercel', name: 'Vercel', category: '호스팅 사용량', usageBased: true, patterns: [/VERCEL/i],
    links: [{ label: '도움말 센터', url: 'https://vercel.com/help' }],
    note: '사용량 초과 청구는 대시보드 Usage 화면을 캡처해 문의합니다.' },
  { id: 'stripe', name: 'Stripe 결제대행', category: '결제대행 (실제 판매자는 별표 뒤)', usageBased: false, processor: true, patterns: [/STRIPE\s*\*/i],
    links: [{ label: 'Stripe 지원', url: 'https://support.stripe.com/' }],
    note: 'STRIPE * 뒤의 이름이 실제 판매자입니다. 환불은 판매자에게 요청하고 Stripe는 처리 대행만 합니다.' },
  { id: 'paddle', name: 'Paddle 결제대행', category: '결제대행 (실제 판매자 조회 필요)', usageBased: false, processor: true, patterns: [/PADDLE/i],
    links: [{ label: '청구 내역 조회', url: 'https://paddle.net' }],
    note: 'PADDLE.NET* 표기는 판매자 대신 청구한 것입니다. paddle.net에서 청구 내역을 조회하면 실제 판매자와 환불 창구가 나옵니다.' },
];

export function lookupMerchant(descriptor: string | null, merchant: string | null): Merchant | null {
  const candidates = [descriptor, merchant].filter((v): v is string => !!v && v.trim().length > 0);
  for (const text of candidates) {
    const hit = MERCHANTS.find(m => m.patterns.some(p => p.test(text)));
    if (hit) return hit;
  }
  return null;
}

export function sellerFromDescriptor(descriptor: string | null): string | null {
  if (!descriptor) return null;
  const m = descriptor.match(/^(?:STRIPE|PADDLE\.NET|PAYPAL|SQ|FS|SP)\s*\*\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

// 국제브랜드 분쟁 사유 매핑. 확정이 아니라 카드사 상담 전에 준비할 후보다.
export type ReasonMapping = {
  visa: { code: string; name: string };
  mastercard: { code: string; name: string };
  summary: string;
  caution: string;
};

export const REASON_CODES: Record<CaseType, ReasonMapping | null> = {
  cancelled_recurring: {
    visa: { code: '13.2', name: 'Cancelled Recurring Transaction' },
    mastercard: { code: '4853', name: 'Cardholder Dispute (취소된 정기결제)' },
    summary: '해지 요청 뒤에도 정기 청구가 이어진 경우. 해지 요청 기록과 청구 대상 기간이 핵심입니다.',
    caution: '해지 요청일과 효력일이 다르면 청구가 정당할 수 있습니다. 가맹점 해지 정책을 먼저 확인합니다.',
  },
  duplicate: {
    visa: { code: '12.6.1', name: 'Duplicate Processing' },
    mastercard: { code: '4834', name: 'Point of Interaction Error (중복 처리)' },
    summary: '한 거래가 두 번 매입된 경우. 승인 알림 중복은 해당하지 않으며 매입 내역 두 건이 필요합니다.',
    caution: '승인만 두 번 잡히고 매입은 한 건이면 며칠 뒤 자동 해제됩니다. 매입 확정 후 판단합니다.',
  },
  billing_error: {
    visa: { code: '12.5', name: 'Incorrect Amount' },
    mastercard: { code: '4834', name: 'Point of Interaction Error (금액 불일치)' },
    summary: '합의한 금액·요금제와 실제 청구가 다른 경우. 약정 금액을 보여주는 화면이 필요합니다.',
    caution: '사용량 기반 요금은 "합의 금액"이 단가입니다. 단가는 맞고 사용량이 다투어지면 금액 오류가 아니라 서비스 분쟁으로 봅니다.',
  },
  credential_theft: {
    visa: { code: '보류', name: '가맹점 검토 결과에 따라 결정' },
    mastercard: { code: '보류', name: '가맹점 검토 결과에 따라 결정' },
    summary: 'API 키나 계정이 도용돼 사용량이 발생한 경우. 카드 자체가 도용된 것이 아니므로 카드 도용 코드(Visa 10.4, MC 4837)는 맞지 않습니다.',
    caution: '대부분 가맹점의 미승인 사용 검토 절차에서 해결됩니다. 가맹점이 거절하면 그 회신을 근거로 카드사와 적용 가능한 사유를 상담합니다.',
  },
  not_received: {
    visa: { code: '13.1', name: 'Merchandise/Services Not Received' },
    mastercard: { code: '4853', name: 'Cardholder Dispute (서비스 미제공)' },
    summary: '결제했지만 서비스가 제공되지 않은 경우. 제공 예정일과 미제공 증빙이 필요합니다.',
    caution: '디지털 서비스는 접속 기록으로 제공 여부가 판단됩니다. 접속 불가 화면과 시각을 남겨 두세요.',
  },
  unknown: null,
};

// 증빙 체크리스트. keywords는 사용자 단서에서 자동 체크할 때 쓴다.
export type EvidenceItem = { id: string; label: string; hint: string; keywords: string[] };

const COMMON_EVIDENCE: EvidenceItem[] = [
  { id: 'transaction', label: '카드 거래 내역 (승인·매입 화면)', hint: '카드 앱에서 거래 상태, 통화, 금액, 가맹점 표기가 보이는 화면', keywords: ['매입', '승인', '카드 앱', '카드 거래', '거래 내역'] },
  { id: 'contact', label: '가맹점 문의 기록 (날짜·채널·답변)', hint: '카드사는 가맹점과 먼저 해결을 시도했는지 확인합니다', keywords: ['문의', '고객센터', '티켓', '회신', '답변'] },
];

export const EVIDENCE: Record<CaseType, EvidenceItem[]> = {
  cancelled_recurring: [
    { id: 'cancel_request', label: '해지 요청 기록 (화면·메일)', hint: '요청 일시가 보이는 캡처', keywords: ['해지 요청', '해지를 요청', '취소 요청'] },
    { id: 'cancel_confirm', label: '해지 확인 또는 효력일 안내', hint: '"구독이 X일에 종료됩니다" 메일', keywords: ['해지 확인', '종료', '효력'] },
    { id: 'billing_period', label: '청구 대상 기간 안내', hint: '이번 청구가 어느 기간 요금인지', keywords: ['기간', '청구 대상'] },
    { id: 'terms', label: '구독 약관의 해지 조항', hint: '해지 시점과 환불 규정', keywords: ['약관', '정책'] },
  ],
  duplicate: [
    { id: 'order', label: '주문 확인서 1건', hint: '주문 수량과 금액이 보이는 화면', keywords: ['주문', '한 번', '1건', '한 건'] },
    { id: 'posted_twice', label: '매입 내역 2건 (거래 식별자)', hint: '승인 알림이 아니라 매입 내역이어야 합니다', keywords: ['매입 내역 2', '두 건 매입', '매입 두'] },
    { id: 'merchant_reply', label: '가맹점 회신 (중복 인정 여부)', hint: '환불 예정이라는 답변이 있으면 접수 불필요', keywords: ['회신', '환불 예정'] },
  ],
  billing_error: [
    { id: 'invoice', label: '청구서·인보이스', hint: '항목과 산출 근거가 보이는 원본', keywords: ['청구서', '인보이스', 'invoice'] },
    { id: 'plan', label: '요금제·단가 화면', hint: '가입 당시 안내된 금액', keywords: ['요금제', '단가', '플랜', 'plan'] },
    { id: 'usage', label: '사용량 대시보드 캡처', hint: '청구 기간의 실제 사용량', keywords: ['사용량', '대시보드', 'usage'] },
    { id: 'merchant_reply', label: '가맹점 회신', hint: '정정 거부 사유', keywords: ['회신', '답변'] },
  ],
  credential_theft: [
    { id: 'key_rotation', label: '키 삭제·재발급 기록 (시각)', hint: '콘솔의 키 목록 변경 화면', keywords: ['키를 삭제', '재발급', '새로 발급', '키 삭제'] },
    { id: 'usage_log', label: '사용량 로그 (급증 구간·출처)', hint: '평소 사용량과 급증 시점을 대비', keywords: ['사용량', '급증', 'IP', '로그'] },
    { id: 'baseline', label: '본인 사용량 기준 진술', hint: '평소 월 사용액과 용도', keywords: ['지난달', '평소', '월 '] },
    { id: 'limit', label: '지출 한도·예산 설정 화면', hint: '재발 방지 조치 증빙', keywords: ['한도', '예산', 'limit'] },
    { id: 'review_request', label: '가맹점 미승인 사용 검토 요청 기록', hint: '티켓 번호와 접수 시각', keywords: ['검토 요청', '티켓', '문의'] },
  ],
  not_received: [
    { id: 'order', label: '주문·결제 확인서', hint: '제공 예정 내용과 일정', keywords: ['주문', '결제 확인'] },
    { id: 'not_delivered', label: '미제공 증빙 (접속 불가 화면 등)', hint: '시각이 보이는 캡처', keywords: ['접속 불가', '제공되지', '받지 못'] },
  ],
  unknown: [],
};

export function evidenceFor(caseType: CaseType): EvidenceItem[] {
  return [...COMMON_EVIDENCE, ...EVIDENCE[caseType]];
}

export function autoChecked(parsed: Parsed): Record<string, boolean> {
  const corpus = parsed.facts.map(f => `${f.label} ${f.value} ${f.quote}`).join('\n');
  const out: Record<string, boolean> = {};
  for (const item of evidenceFor(parsed.caseType)) out[item.id] = item.keywords.some(k => corpus.includes(k));
  return out;
}

export function readiness(items: EvidenceItem[], checks: Record<string, boolean>) {
  const done = items.filter(i => checks[i.id]).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

// 72시간 플레이북. 사건 유형과 가맹점에 따라 결정되는 고정 단계 + AI가 제안한 행동을 긴급도별로 합친다.
export type Step = { id: string; title: string; detail: string; link?: { label: string; url: string }; source: 'rule' | 'ai' };
export type Phase = { id: 'stop' | 'merchant' | 'issuer'; title: string; window: string; goal: string; steps: Step[] };

const KEEP_ORIGINALS: Step = { id: 'keep', title: '카드 알림·메일 원문 보관', detail: '삭제하지 말고 캡처와 원본 메일을 그대로 둡니다. 나중에 날짜와 표기를 대조합니다.', source: 'rule' };

// 결제대행(Stripe 등)의 링크는 판매자 콘솔이 아니므로 조치 단계에 붙이지 않는다. Paddle은 구매자 조회 페이지가 있어 예외.
function merchantLink(merchant: Merchant | null) {
  if (!merchant) return undefined;
  if (merchant.processor) return merchant.id === 'paddle' ? merchant.links[0] : undefined;
  return merchant.links[0];
}

function stopSteps(parsed: Parsed, merchant: Merchant | null): Step[] {
  const link = merchantLink(merchant);
  switch (parsed.caseType) {
    case 'credential_theft':
      return [
        { id: 'rotate', title: '유출 의심 키 삭제 후 재발급', detail: '비활성화가 아니라 삭제합니다. 대기 중인 요청까지 끊깁니다. 삭제 시각을 기록해 두세요.', link, source: 'rule' },
        { id: 'cap', title: '지출 한도·예산 알림 설정', detail: '월 한도를 걸 수 있으면 지금 겁니다. 알림만 오는 예산은 차단이 아닙니다.', link: merchant?.links.find(l => /한도|예산|이상/.test(l.label)) ?? link, source: 'rule' },
        { id: 'snapshot', title: '사용량 대시보드 급증 구간 캡처', detail: '평소 사용량과 급증 시점, 가능하면 요청 출처를 화면으로 남깁니다.', source: 'rule' },
        { id: 'leak', title: '코드·저장소에서 키 노출 점검', detail: '공개 저장소, 클라이언트 번들, 공유 문서에 키가 남아 있는지 확인합니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'cancelled_recurring':
      return [
        { id: 'cancel_state', title: '가맹점 계정에서 해지 상태·효력일 확인 후 캡처', detail: '해지 요청과 해지 완료는 다릅니다. 종료일이 적힌 화면이나 메일을 찾습니다.', link, source: 'rule' },
        { id: 'block', title: '카드사 앱에서 정기결제·해외결제 차단 검토', detail: '다음 청구를 막는 조치입니다. 카드 교체만으로는 토큰 결제가 계속될 수 있습니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'duplicate':
      return [
        { id: 'posted_count', title: '카드 앱에서 실제 매입 건수와 거래 식별자 확인', detail: '승인 알림 두 번과 매입 두 건은 다릅니다. 매입이 한 건이면 나머지 승인은 자동 해제를 기다립니다.', source: 'rule' },
        { id: 'order_proof', title: '주문 확인서 보관', detail: '수량 1건과 금액이 보이는 화면을 남깁니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'billing_error':
      return [
        { id: 'plan_proof', title: '요금제·단가·사용량 화면 캡처', detail: '가입 당시 안내 금액과 청구 기간의 사용량을 함께 남깁니다.', link, source: 'rule' },
        { id: 'retry_block', title: '반복 결제 시도 방지 조치', detail: '결제 수단을 바꾸거나 카드사 앱에서 해당 가맹점 결제를 잠시 막습니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'not_received':
      return [
        { id: 'order_proof', title: '주문·결제 확인서 보관', detail: '제공 예정 내용과 일정이 보이는 화면입니다.', source: 'rule' },
        { id: 'fail_proof', title: '서비스 접속 불가 화면 캡처', detail: '시각이 보이도록 남깁니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    default:
      return [
        { id: 'status', title: '카드 앱에서 거래 상태 확인', detail: '승인인지 매입인지, 통화와 금액이 무엇인지 확인합니다.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
  }
}

function merchantSteps(parsed: Parsed, merchant: Merchant | null): Step[] {
  const seller = sellerFromDescriptor(parsed.descriptor);
  const target = merchant?.processor ? (seller || parsed.merchant || '실제 판매자') : (merchant?.name || parsed.merchant || '가맹점');
  const steps: Step[] = [
    { id: 'inquire', title: `${target}에 공식 채널로 문의`, detail: merchant?.note || '영수증 메일의 공식 도메인이나 계정 화면의 지원 메뉴를 사용합니다. 아래 영문 초안을 검토해 보내세요.', link: merchantLink(merchant), source: 'rule' },
    { id: 'ticket', title: '티켓 번호·접수 시각 기록', detail: '카드사 접수 시 "가맹점과 해결을 시도했다"는 근거가 됩니다.', source: 'rule' },
    { id: 'followup', title: '답변이 없으면 5~7일 뒤 같은 티켓에 재문의', detail: '새 티켓을 열지 말고 같은 대화에 이어서 기록을 남깁니다.', source: 'rule' },
  ];
  if (parsed.caseType === 'credential_theft') steps.splice(1, 0, { id: 'review', title: '미승인 사용 검토·환불 요청', detail: '키 삭제 시각, 급증 구간, 평소 사용량을 함께 제출합니다.', link: merchant?.links.find(l => /미승인|검토/.test(l.label)), source: 'rule' });
  return steps;
}

function issuerSteps(parsed: Parsed): Step[] {
  const noPosting = parsed.paymentStatus === 'declined' || parsed.paymentStatus === 'invoice_only';
  return noPosting
    ? [
        { id: 'issuer_block', title: '카드사에 반복 시도 차단 상담', detail: '매입이 없어도 재시도 방지와 해외결제 차단은 지금 상담할 수 있습니다.', source: 'rule' },
        { id: 'watch', title: '매입 발생 여부 매일 확인', detail: '매입이 생기면 그 날짜가 기준일이 됩니다. 이 보드로 돌아와 갱신하세요.', source: 'rule' },
      ]
    : [
        { id: 'evidence', title: '이의신청 패키지의 증빙 체크리스트 채우기', detail: '빠진 항목은 가맹점 회신을 기다리는 동안 준비합니다.', source: 'rule' },
        { id: 'issuer_form', title: '카드사 앱·고객센터에서 해외이용 이의신청 요건과 양식 확인', detail: '카드사마다 양식과 접수 채널이 다릅니다. 미리 채운 항목을 옮겨 적습니다.', source: 'rule' },
        { id: 'file', title: '가맹점이 거절하거나 무응답이면 접수', detail: '가맹점 회신 또는 무응답 기록을 첨부합니다. 접수 후 가맹점 답변에 45일이 걸릴 수 있습니다.', source: 'rule' },
      ];
}

export function buildPlan(parsed: Parsed, merchant: Merchant | null, actions: Report['actions'] = []): Phase[] {
  const ai = (urgency: Report['actions'][number]['urgency']) =>
    actions.filter(a => a.urgency === urgency).map((a, i) => ({ id: `ai-${urgency}-${i}`, title: a.title, detail: a.description, source: 'ai' as const }));
  return [
    { id: 'stop', title: '지혈', window: '0~2시간', goal: '추가 청구를 막고 증거를 얼립니다', steps: [...stopSteps(parsed, merchant), ...ai('now')] },
    { id: 'merchant', title: '가맹점', window: '24시간 안에', goal: '가장 빨리 환불되는 경로입니다', steps: [...merchantSteps(parsed, merchant), ...ai('today')] },
    { id: 'issuer', title: '카드사 준비', window: '72시간 안에', goal: '거절에 대비해 접수 서류를 갖춥니다', steps: [...issuerSteps(parsed), ...ai('next')] },
  ];
}

// 참고 기한. 국제브랜드 규정상 통상 120일. 사유별 기준일이 달라 카드사 확인이 필요하므로 "참고치"로만 쓴다.
export const REFERENCE_DAYS = 120;

export function referenceDeadline(transactionDate: string | null, today = new Date()): { due: string; daysLeft: number } | null {
  if (!transactionDate || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) return null;
  const [y, m, d] = transactionDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  if (Number.isNaN(base.getTime())) return null;
  const due = new Date(y, m - 1, d + REFERENCE_DAYS);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.round((due.getTime() - start.getTime()) / 86400000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { due: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`, daysLeft };
}

// 카드사 이의신청서에 옮겨 적을 항목. 실제 양식은 카드사마다 다르다.
export function issuerForm(parsed: Parsed, merchant: Merchant | null, mapping: ReasonMapping | null, timeline: string): { label: string; value: string }[] {
  const seller = sellerFromDescriptor(parsed.descriptor);
  return [
    { label: '신청인', value: '[직접 입력]' },
    { label: '카드사 · 카드번호', value: '[카드사 앱에서 확인]' },
    { label: '거래일', value: parsed.transactionDate || '[카드 앱에서 확인]' },
    { label: '가맹점 표기', value: parsed.descriptor || parsed.merchant || '[카드 문자의 표기 그대로]' },
    { label: '실제 사업자', value: seller || merchant?.name || parsed.merchant || '[확인 필요]' },
    { label: '금액 · 통화', value: parsed.amount || '[카드 앱에서 확인]' },
    { label: '거래 상태', value: parsed.paymentStatus === 'posted' ? '매입 완료' : parsed.paymentStatus === 'approved' ? '승인 (매입 확인 필요)' : parsed.paymentStatus === 'declined' ? '승인 거절' : parsed.paymentStatus === 'invoice_only' ? '청구서만 수신' : '확인 필요' },
    { label: '분쟁 사유 (후보)', value: mapping ? `Visa ${mapping.visa.code} ${mapping.visa.name} / Mastercard ${mapping.mastercard.code} ${mapping.mastercard.name}` : '카드사 상담으로 결정' },
    { label: '사실 요약', value: parsed.summary },
    { label: '가맹점 접촉 내역', value: timeline.trim() || '[날짜 · 채널 · 티켓 번호 · 답변 요지]' },
    { label: '요청 사항', value: '거래 대금 환급 및 동일 가맹점 추가 청구 방지' },
  ];
}
