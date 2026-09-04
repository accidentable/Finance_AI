export type Sample = { id: string; label: string; text: string };

/**
 * 합성 데모 데이터. 이름·금액·번호·주소는 전부 가상이며 실제 사건·개인과 무관하다.
 */
export const SAMPLES: Sample[] = [
  {
    id: "invoice-only",
    label: "사용량 0인데 25억 원 청구서",
    text: `[이메일 원문]
From: Anthropic Billing <billing@mail.anthropic.com>
To: dev@haneul-labs.example
Date: 2026-07-18 08:31 (KST)
Subject: Invoice INV-2026-0718-4471 is now due — Organization "Haneul Labs"

Hello,

Your invoice INV-2026-0718-4471 for organization Haneul Labs (org_7f3k2q) has been issued.

Amount due: USD 1,842,500.00
Billing period: 2026-06-18 – 2026-07-17
Payment method on file: Visa ending 4471
Status: Payment attempt failed (card declined). We will retry automatically.

To avoid service interruption, please update your payment method.
This is an automated message. Replies to this address are not monitored.

[카드 문자]
[Web발신] 한빛카드 승인거절 07/18 08:32 ANTHROPIC $1,842,500.00 한도초과
[Web발신] 한빛카드 승인거절 07/19 08:32 ANTHROPIC $1,842,500.00 한도초과
[Web발신] 한빛카드 승인거절 07/20 08:32 ANTHROPIC $1,842,500.00 한도초과

[내 상황]
2인 개발팀이고 지난 두 달 동안 API를 거의 쓰지 않았습니다. 콘솔 사용량 대시보드에는 6월 18일 이후 요청 수 0, 토큰 사용량 0으로 표시되고 있고 그 화면은 캡처해 두었습니다. 평소 월 청구액은 30달러 정도였습니다. 지원 메일 주소로 7월 18일부터 메일을 여러 통 보냈지만 자동 회신만 왔습니다. 카드는 한빛카드 법인 Visa 한 장이고 아직 정지하지 않았습니다. 승인거절 문자가 매일 오고 있어서 불안합니다.`,
  },
  {
    id: "leaked-key",
    label: "유출된 API 키로 48시간에 8만 달러",
    text: `[이메일 원문]
From: Vektra Cloud Billing <no-reply@billing-vektracloud.net>
To: ops@dodam-studio.example
Date: 2026-08-31 02:10 (KST)
Subject: [Vektra Cloud] Usage receipt — Account acct_92hd7x — Invoice VC-88213-0830

Hi Dodam Studio,

Your usage-based charges for 2026-08-29 through 2026-08-30 have been billed to the card on file.

Invoice VC-88213-0830
Charge 1 (2026-08-29): USD 41,200.00 — 3.9B tokens, model vektra-large
Charge 2 (2026-08-30): USD 39,650.00 — 3.7B tokens, model vektra-large
Total billed: USD 80,850.00
Payment method: Mastercard corporate card ending 2291

Questions? Reply to this email or visit the help center.

[카드 문자]
[Web발신] 미래카드 해외승인 08/29 23:58 VEKTRA CLOUD USD 41,200.00 일시불 법인
[Web발신] 미래카드 해외승인 08/30 23:59 VEKTRA CLOUD USD 39,650.00 일시불 법인

[내 상황]
5명짜리 스타트업이고 평소 Vektra Cloud 월 사용료는 400달러 정도였습니다. 8월 28일 저녁에 팀원이 API 키를 공개 저장소에 실수로 올렸고, 그 뒤 48시간 동안 우리 계정에서 대량 요청이 발생했습니다. 콘솔 사용량 로그를 보면 요청이 우리가 쓰지 않는 국가 IP에서 왔고 그 로그는 캡처해 두었습니다. 8월 31일 새벽에 키를 폐기하고 새로 발급했습니다. 아직 Vektra 쪽에 정식으로 이의를 제기하지는 않았고, 미래카드 법인 Mastercard로 두 건 다 승인 완료된 상태입니다. 카드는 정지하지 않았습니다.`,
  },
  {
    id: "cancelled-subscription",
    label: "해지 요청 후에도 결제된 구독",
    text: `[이메일 원문]
From: Stripe <receipts@stripe.com>
To: yujin.park@example.com
Date: 2026-08-15 14:02 (KST)
Subject: Your receipt from Pixelforge Studio #2318-9904

Receipt from Pixelforge Studio
Amount paid: USD 49.00
Date paid: 2026-08-15
Payment method: Visa ending 0817
Description: Pixelforge Pro — Monthly subscription (2026-08-15 to 2026-09-14)
Invoice number: 2318-9904

Previous receipts on file: #2318-8811 (2026-07-15, USD 49.00), #2318-7702 (2026-06-15, USD 49.00)

[카드 문자]
[Web발신] 온누리카드 해외승인 06/15 14:01 PIXELFORGE STUDIO USD 49.00 일시불
[Web발신] 온누리카드 해외승인 07/15 14:01 PIXELFORGE STUDIO USD 49.00 일시불
[Web발신] 온누리카드 해외승인 08/15 14:02 PIXELFORGE STUDIO USD 49.00 일시불

[내 상황]
2026년 6월 2일에 Pixelforge Studio 계정 설정에서 구독 해지를 눌렀고 "Your subscription will be cancelled at the end of the billing period" 화면을 캡처해 뒀습니다. 그런데 6월 15일, 7월 15일, 8월 15일에 49달러가 계속 빠져나갔습니다. 7월 20일에 Pixelforge 고객센터 채팅으로 문의했지만 봇이 "확인 중"이라고만 답하고 끝났고, 그 채팅 기록도 캡처해 두었습니다. 온누리카드 개인 Visa로 결제되었고 카드는 정지하지 않았습니다. 세 번 결제된 147달러를 돌려받고 싶습니다.`,
  },
];
