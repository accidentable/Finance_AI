import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "분쟁72 — 해외결제 분쟁 첫 72시간",
  description:
    "해외결제 청구 메일과 카드 문자를 붙여넣으면 진위, 결제 상태, 적용 규정, 이의신청 기한, 제기 경로를 판정하고 제출 서류를 만듭니다. 보내는 것은 직접 합니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4F6F4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
