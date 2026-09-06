import type { CaseType, Parsed, Report } from './case';
import { findMerchantPolicy, issuerReasonFor, type Issuer, type MerchantPolicy } from './knowledge';

// 가맹점 해독. data/merchant-policies.json의 정책을 표기(디스크립터)나 사업자명으로 찾는다.
export type Merchant = MerchantPolicy & { links: { label: string; url: string }[]; note: string };

export function lookupMerchant(descriptor: string | null, merchant: string | null): Merchant | null {
  const policy = findMerchantPolicy(descriptor, merchant);
  return policy ? { ...policy, links: policy.channels, note: policy.unauthorized } : null;
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
    summary: '해지를 요청했는데도 정기 청구가 이어진 경우예요. 해지 요청 기록과 이번 청구가 어느 기간 요금인지가 핵심이에요.',
    caution: '해지 요청일과 해지 적용일이 다르면 청구가 정당할 수도 있어요. 가맹점 해지 정책부터 확인해요.',
  },
  duplicate: {
    visa: { code: '12.6.1', name: 'Duplicate Processing' },
    mastercard: { code: '4834', name: 'Point of Interaction Error (중복 처리)' },
    summary: '한 거래가 두 번 청구(매입)된 경우예요. 승인 알림이 두 번 온 것만으로는 안 되고, 매입 내역 두 건이 필요해요.',
    caution: '승인만 두 번 잡히고 매입은 한 건이면 며칠 뒤 자동으로 풀려요. 매입이 확정된 뒤에 판단해요.',
  },
  billing_error: {
    visa: { code: '12.5', name: 'Incorrect Amount' },
    mastercard: { code: '4834', name: 'Point of Interaction Error (금액 불일치)' },
    summary: '약속한 금액·요금제와 실제 청구가 다른 경우예요. 약정 금액이 보이는 화면이 필요해요.',
    caution: '사용량 요금은 "약속한 금액"이 단가예요. 단가는 맞고 사용량을 다투는 거라면 금액 오류가 아니라 서비스 분쟁으로 봐요.',
  },
  credential_theft: {
    visa: { code: '보류', name: '가맹점 검토 결과에 따라 결정' },
    mastercard: { code: '보류', name: '가맹점 검토 결과에 따라 결정' },
    summary: 'API 키나 계정이 도용돼 사용량이 생긴 경우예요. 카드 자체가 도용된 게 아니라서 카드 도용 코드(Visa 10.4, MC 4837)는 맞지 않아요.',
    caution: '대부분 가맹점의 미승인 사용 검토에서 해결돼요. 가맹점이 거절하면 그 답장을 근거로 카드사와 쓸 수 있는 사유를 상담해요.',
  },
  not_received: {
    visa: { code: '13.1', name: 'Merchandise/Services Not Received' },
    mastercard: { code: '4853', name: 'Cardholder Dispute (서비스 미제공)' },
    summary: '결제했는데 서비스를 받지 못한 경우예요. 제공 예정일과 못 받았다는 증빙이 필요해요.',
    caution: '디지털 서비스는 접속 기록으로 제공 여부를 판단해요. 접속이 안 되는 화면과 시각을 남겨 두세요.',
  },
  unknown: null,
};

// 증빙 체크리스트. keywords는 사용자 단서에서 자동 체크할 때 쓴다.
export type EvidenceItem = { id: string; label: string; hint: string; keywords: string[] };

const COMMON_EVIDENCE: EvidenceItem[] = [
  { id: 'transaction', label: '카드 거래 내역 (승인·매입 화면)', hint: '카드 앱에서 거래 상태, 통화, 금액, 가맹점 표기가 보이는 화면', keywords: ['매입', '승인', '카드 앱', '카드 거래', '거래 내역'] },
  { id: 'contact', label: '가맹점 문의 기록 (날짜·채널·답장)', hint: '카드사는 가맹점과 먼저 해결해 봤는지 확인해요', keywords: ['문의', '고객센터', '티켓', '회신', '답변'] },
];

export const EVIDENCE: Record<CaseType, EvidenceItem[]> = {
  cancelled_recurring: [
    { id: 'cancel_request', label: '해지 요청 기록 (화면·메일)', hint: '요청한 날짜와 시각이 보이는 캡처', keywords: ['해지 요청', '해지를 요청', '취소 요청'] },
    { id: 'cancel_confirm', label: '해지 확인 또는 적용일 안내', hint: '"구독이 X일에 끝나요" 같은 메일', keywords: ['해지 확인', '종료', '효력'] },
    { id: 'billing_period', label: '청구 대상 기간 안내', hint: '이번 청구가 어느 기간 요금인지', keywords: ['기간', '청구 대상'] },
    { id: 'terms', label: '구독 약관의 해지 조항', hint: '해지 시점과 환불 규정', keywords: ['약관', '정책'] },
  ],
  duplicate: [
    { id: 'order', label: '주문 확인서 1건', hint: '주문 수량과 금액이 보이는 화면', keywords: ['주문', '한 번', '1건', '한 건'] },
    { id: 'posted_twice', label: '매입 내역 2건 (거래 번호)', hint: '승인 알림이 아니라 매입 내역이어야 해요', keywords: ['매입 내역 2', '두 건 매입', '매입 두'] },
    { id: 'merchant_reply', label: '가맹점 답장 (중복 인정 여부)', hint: '환불 예정이라는 답장이 있으면 접수는 필요 없어요', keywords: ['회신', '환불 예정'] },
  ],
  billing_error: [
    { id: 'invoice', label: '청구서·인보이스', hint: '항목과 계산 근거가 보이는 원본', keywords: ['청구서', '인보이스', 'invoice'] },
    { id: 'plan', label: '요금제·단가 화면', hint: '가입할 때 안내받은 금액', keywords: ['요금제', '단가', '플랜', 'plan'] },
    { id: 'usage', label: '사용량 대시보드 캡처', hint: '청구 기간에 실제로 쓴 양', keywords: ['사용량', '대시보드', 'usage'] },
    { id: 'merchant_reply', label: '가맹점 답장', hint: '정정을 거절한 이유', keywords: ['회신', '답변'] },
  ],
  credential_theft: [
    { id: 'key_rotation', label: '키 삭제·재발급 기록 (시각)', hint: '콘솔에서 키 목록이 바뀐 화면', keywords: ['키를 삭제', '재발급', '새로 발급', '키 삭제'] },
    { id: 'usage_log', label: '사용량 로그 (급증 구간·출처)', hint: '평소 사용량과 급증한 시점을 나란히', keywords: ['사용량', '급증', 'IP', '로그'] },
    { id: 'baseline', label: '내 평소 사용량 정리', hint: '평소 월 사용액과 용도', keywords: ['지난달', '평소', '월 '] },
    { id: 'limit', label: '지출 한도·예산 설정 화면', hint: '다시 안 새게 막았다는 증빙', keywords: ['한도', '예산', 'limit'] },
    { id: 'review_request', label: '가맹점 미승인 사용 검토 요청 기록', hint: '티켓 번호와 접수 시각', keywords: ['검토 요청', '티켓', '문의'] },
  ],
  not_received: [
    { id: 'order', label: '주문·결제 확인서', hint: '받기로 한 내용과 일정', keywords: ['주문', '결제 확인'] },
    { id: 'not_delivered', label: '못 받았다는 증빙 (접속 불가 화면 등)', hint: '시각이 보이는 캡처', keywords: ['접속 불가', '제공되지', '받지 못'] },
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

// 72시간 플레이북. 사건 유형과 가맹점, 카드사에 따라 정해지는 고정 단계 + AI가 제안한 행동을 긴급도별로 합친다.
export type Step = { id: string; title: string; detail: string; link?: { label: string; url: string }; source: 'rule' | 'ai'; refId?: string };
export type Phase = { id: 'stop' | 'merchant' | 'issuer'; title: string; window: string; goal: string; steps: Step[] };

const KEEP_ORIGINALS: Step = { id: 'keep', title: '카드 문자와 메일 원본 그대로 두기', detail: '지우지 말고 캡처와 원본 메일을 그대로 두세요. 나중에 날짜와 표기를 맞춰 볼 때 필요해요.', source: 'rule' };

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
        { id: 'rotate', title: '새어 나간 것 같은 키 지우고 새로 만들기', detail: '비활성화 말고 삭제해 주세요. 대기 중인 요청까지 끊겨요. 지운 시각도 적어 두세요.', link, source: 'rule' },
        { id: 'cap', title: '지출 한도와 예산 알림 걸기', detail: '월 한도를 걸 수 있으면 지금 걸어요. 알림만 오는 예산은 결제를 막아 주지 않아요.', link: merchant?.links.find(l => /한도|예산|이상/.test(l.label)) ?? link, source: 'rule' },
        { id: 'snapshot', title: '사용량 대시보드에서 급증한 구간 캡처하기', detail: '평소 사용량과 급증한 시점, 가능하면 요청 출처까지 화면으로 남겨요.', source: 'rule' },
        { id: 'leak', title: '코드와 저장소에 키가 남아 있는지 보기', detail: '공개 저장소, 앱 코드, 공유 문서에 키가 들어 있지 않은지 확인해요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'cancelled_recurring':
      return [
        { id: 'cancel_state', title: '가맹점 계정에서 해지 상태와 적용일 확인해 캡처하기', detail: '해지 요청과 해지 완료는 달라요. 끝나는 날짜가 적힌 화면이나 메일을 찾아요.', link, source: 'rule' },
        { id: 'block', title: '카드사 앱에서 정기결제나 해외결제 막기', detail: '다음 청구를 막는 조치예요. 카드만 바꾸면 새 카드로 계속 청구될 수 있어요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'duplicate':
      return [
        { id: 'posted_count', title: '카드 앱에서 실제 매입 건수와 거래 번호 확인하기', detail: '승인 알림 두 번과 매입 두 건은 달라요. 매입이 한 건이면 나머지 승인은 자동으로 풀리길 기다려요.', source: 'rule' },
        { id: 'order_proof', title: '주문 확인서 남기기', detail: '수량 1건과 금액이 보이는 화면을 저장해요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'billing_error':
      return [
        { id: 'plan_proof', title: '요금제·단가·사용량 화면 캡처하기', detail: '가입할 때 안내받은 금액과 청구 기간에 쓴 양을 같이 남겨요.', link, source: 'rule' },
        { id: 'retry_block', title: '반복 결제 시도 막기', detail: '결제 수단을 바꾸거나 카드사 앱에서 이 가맹점 결제를 잠시 막아요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    case 'not_received':
      return [
        { id: 'order_proof', title: '주문·결제 확인서 남기기', detail: '받기로 한 내용과 일정이 보이는 화면이에요.', source: 'rule' },
        { id: 'fail_proof', title: '서비스가 안 되는 화면 캡처하기', detail: '시각이 보이게 남겨요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
    default:
      return [
        { id: 'status', title: '카드 앱에서 거래 상태 확인하기', detail: '승인인지 매입인지, 통화와 금액이 무엇인지 봐요.', source: 'rule' },
        KEEP_ORIGINALS,
      ];
  }
}

function merchantSteps(parsed: Parsed, merchant: Merchant | null): Step[] {
  const seller = sellerFromDescriptor(parsed.descriptor);
  const target = merchant?.processor ? (seller || parsed.merchant || '실제 판매자') : (merchant?.name || parsed.merchant || '가맹점');
  const steps: Step[] = [
    { id: 'inquire', title: `${target}에 공식 창구로 문의하기`, detail: merchant?.note || '영수증 메일의 공식 도메인이나 계정 화면의 고객지원 메뉴를 써요. 아래 영문 초안을 확인하고 보내 주세요.', link: merchantLink(merchant), source: 'rule' },
    { id: 'ticket', title: '티켓 번호와 접수 시각 적어 두기', detail: '카드사에 접수할 때 "가맹점과 먼저 해결해 봤다"는 근거가 돼요.', source: 'rule' },
    { id: 'followup', title: '답장이 없으면 5~7일 뒤 같은 티켓에 다시 묻기', detail: '새 티켓을 열지 말고 같은 대화에 이어서 기록을 남겨요.', source: 'rule' },
  ];
  if (parsed.caseType === 'credential_theft') steps.splice(1, 0, { id: 'review', title: '미승인 사용 검토와 환불 요청하기', detail: '키 지운 시각, 급증 구간, 평소 사용량을 함께 보내요.', link: merchant?.links.find(l => /미승인|검토/.test(l.label)), source: 'rule' });
  return steps;
}

function issuerSteps(parsed: Parsed, issuer: Issuer | null): Step[] {
  const noPosting = parsed.paymentStatus === 'declined' || parsed.paymentStatus === 'invoice_only';
  const primary = issuer?.channels.find(c => c.type === 'web' || c.type === 'app') ?? issuer?.channels[0];
  const link = primary?.url ? { label: `${issuer!.name} 접수 화면`, url: primary.url } : undefined;
  const reason = issuer ? issuerReasonFor(issuer, parsed.caseType) : null;
  if (noPosting) {
    return [
      { id: 'issuer_block', title: issuer ? `${issuer.name}에 반복 시도 차단 상담하기 (${issuer.phone})` : '카드사에 반복 시도 차단 상담하기', detail: '매입이 없어도 다시 시도되는 걸 막거나 해외결제를 잠그는 상담은 지금 할 수 있어요.', link, source: 'rule' },
      { id: 'watch', title: '매입이 생기는지 매일 확인하기', detail: issuer ? `매입이 생기면 그 날짜가 기준일이에요. ${issuer.name} 안내: ${issuer.deadline}` : '매입이 생기면 그 날짜가 기준일이에요. 이 화면으로 돌아와서 업데이트해 주세요.', source: 'rule' },
    ];
  }
  return [
    { id: 'evidence', title: '이의신청 패키지의 증빙 체크리스트 채우기', detail: issuer?.documents.length ? `${issuer.name}가 안내하는 서류: ${issuer.documents.join(', ')}` : '빠진 항목은 가맹점 답장을 기다리는 동안 준비해요.', source: 'rule' },
    {
      id: 'issuer_form',
      title: issuer ? `${issuer.name} 해외이용 이의신청 접수 화면 열기` : '카드사 앱이나 고객센터에서 해외이용 이의신청 요건과 양식 확인하기',
      detail: issuer
        ? `${primary?.label ?? issuer.phone}. 기한 안내: ${issuer.deadline}.${reason ? ` 사유는 "${reason}"으로 골라요.` : ''}`
        : '카드사마다 양식과 접수 채널이 달라요. 사건 티켓에서 카드사를 고르면 채널과 기한을 보여드려요.',
      link, source: 'rule',
    },
    { id: 'file', title: '가맹점이 거절하거나 답이 없으면 접수하기', detail: issuer ? `가맹점 답장이나 답이 없었다는 기록을 첨부해요. ${issuer.name} 처리 기간 안내: ${issuer.processing}` : '가맹점 답장이나 답이 없었다는 기록을 첨부해요. 접수 뒤 가맹점 답변에 45일이 걸릴 수 있어요.', source: 'rule' },
  ];
}

export function buildPlan(parsed: Parsed, merchant: Merchant | null, actions: Report['actions'] = [], issuer: Issuer | null = null): Phase[] {
  const ai = (urgency: Report['actions'][number]['urgency']) =>
    actions.filter(a => a.urgency === urgency).map((a, i) => ({ id: `ai-${urgency}-${i}`, title: a.title, detail: a.description, source: 'ai' as const, refId: a.sourceId }));
  return [
    { id: 'stop', title: '지혈', window: '0~2시간', goal: '더 나가는 돈을 막고 증거를 남겨요', steps: [...stopSteps(parsed, merchant), ...ai('now')] },
    { id: 'merchant', title: '가맹점', window: '24시간 안에', goal: '가장 빨리 환불되는 길이에요', steps: [...merchantSteps(parsed, merchant), ...ai('today')] },
    { id: 'issuer', title: '카드사 준비', window: '72시간 안에', goal: '거절될 때를 대비해 서류를 갖춰요', steps: [...issuerSteps(parsed, issuer), ...ai('next')] },
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
export function issuerForm(parsed: Parsed, merchant: Merchant | null, mapping: ReasonMapping | null, timeline: string, issuer: Issuer | null = null): { label: string; value: string }[] {
  const seller = sellerFromDescriptor(parsed.descriptor);
  const issuerReason = issuerReasonFor(issuer, parsed.caseType);
  const primary = issuer?.channels.find(c => c.type === 'web' || c.type === 'app') ?? issuer?.channels[0];
  return [
    { label: '신청인', value: '[직접 입력]' },
    { label: '카드사 · 카드번호', value: issuer ? `${issuer.name} · [카드번호는 앱에서 확인]` : '[카드사 앱에서 확인]' },
    ...(issuer ? [
      { label: '접수 채널', value: primary?.label ?? issuer.phone },
      { label: '카드사 사유 이름', value: issuerReason ?? '[카드사 사유 목록에서 가장 가까운 항목 선택]' },
      { label: '카드사 기한 안내', value: issuer.deadline },
    ] : []),
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
