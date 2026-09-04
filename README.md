# 분쟁72 — 해외결제 분쟁 첫 72시간 에이전트

청구 메일·카드 문자·상황 설명(텍스트 또는 사진 캡처)을 붙여넣으면 6단계(읽기 → 진위 → 규정 → 기한 → 판정 → 서류)를 실행해 제기 경로와 제출 서류를 만듭니다. 발송·접수는 하지 않습니다.

1. 설치: `npm install`
2. 환경변수: `.env.example`을 `.env.local`로 복사하고 `OPENAI_API_KEY`를 채웁니다. `OPENAI_MODEL`은 비우면 `gpt-5.6-sol`.
3. 개발 서버: `npm run dev` 후 http://localhost:3000
4. 빌드 확인: `npm run build`
5. Vercel 배포: 저장소를 연결한 뒤 프로젝트 Settings → Environment Variables에 `OPENAI_API_KEY`(필수), `OPENAI_MODEL`(선택)을 등록하고 배포합니다. API 라우트는 `maxDuration = 120`이며, 사진은 브라우저에서 1600px 이하 JPEG로 줄여 최대 4장까지 보냅니다.
