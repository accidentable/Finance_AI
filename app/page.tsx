"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SAMPLES } from "@/lib/samples";
import { SOURCE_LABEL, type Rule } from "@/lib/rules";
import type { Deadline, Drafts, Judgment, Parsed, StepName, Verify } from "@/lib/agent";

type StepStatus = "idle" | "running" | "done" | "error";

const STEP_ORDER: { key: StepName; label: string }[] = [
  { key: "parse", label: "청구 내용 읽기" },
  { key: "verify", label: "발신자 진위 확인" },
  { key: "rules", label: "적용 규정 찾기" },
  { key: "deadline", label: "이의신청 기한 계산" },
  { key: "judge", label: "제기 경로 판정" },
  { key: "draft", label: "제출 서류 작성" },
];

type StepState = Record<StepName, { status: StepStatus; note?: string }>;

const initialSteps = (): StepState => ({
  parse: { status: "idle" },
  verify: { status: "idle" },
  rules: { status: "idle" },
  deadline: { status: "idle" },
  judge: { status: "idle" },
  draft: { status: "idle" },
});

type Results = {
  parsed?: Parsed;
  verify?: Verify;
  rules?: Rule[];
  deadline?: Deadline;
  judgment?: Judgment;
  drafts?: Drafts;
};

type DocTab = "email" | "statement" | "timeline";

type Attached = { id: string; name: string; mime: string; data: string; preview: string };

const MAX_IMAGES = 4;
const MAX_EDGE = 1600;

/** 브라우저에서 사진을 1600px 이하 JPEG로 줄여 base64로 만든다. 서버 본문 크기 제한 때문 */
function shrinkImage(file: File): Promise<{ mime: string; data: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("사진을 처리하지 못했습니다."));
        return;
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      resolve({ mime: "image/jpeg", data: dataUrl.split(",")[1] ?? "", preview: dataUrl });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("사진 파일을 열지 못했습니다."));
    };
    img.src = url;
  });
}

const URGENCY_LABEL: Record<string, string> = {
  now: "지금",
  today: "오늘",
  this_week: "이번 주",
};

const SOURCE_TAG: Record<string, string> = {
  user: "나",
  merchant: "사업자",
  issuer: "카드사",
  agent: "이 서비스",
};

const PLACEHOLDER = `붙여넣는 순서
1) 청구 메일 원문 (보낸사람 주소가 보이게)
2) 카드 승인·거절 문자
3) 내 상황 (언제 무엇을 했고, 무엇을 갖고 있는지)

예시 칩을 누르면 가상 사례가 채워집니다.`;

export default function Page() {
  const [phase, setPhase] = useState<"input" | "result">("input");
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState>(initialSteps);
  const [results, setResults] = useState<Results>({});
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [tab, setTab] = useState<DocTab>("email");
  const [copied, setCopied] = useState<DocTab | null>(null);
  const [images, setImages] = useState<Attached[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const addFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        setInputError(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
        return;
      }
      const files = Array.from(list)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, room);
      if (files.length === 0) {
        setInputError("이미지 파일만 첨부할 수 있습니다.");
        return;
      }
      try {
        const made = await Promise.all(files.map(shrinkImage));
        setImages((prev) => [
          ...prev,
          ...made.map((m, i) => ({
            id: `${Date.now()}-${i}`,
            name: files[i].name,
            ...m,
          })),
        ]);
        setInputError(null);
      } catch (err) {
        setInputError((err as Error).message);
      }
    },
    [images.length],
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const applyEvent = useCallback((e: { step: string; status: string; note?: string; data?: unknown }) => {
    if (e.step === "final") {
      setResults((prev) => ({ ...prev, ...(e.data as Results) }));
      return;
    }
    if (e.step === "fatal") {
      setFatal(e.note ?? "판정 중 오류가 발생했습니다.");
      return;
    }
    const step = e.step as StepName;
    setSteps((prev) => ({
      ...prev,
      [step]: { status: e.status as StepStatus, note: e.note ?? prev[step]?.note },
    }));
    if (e.status === "done" && e.data !== undefined) {
      setResults((prev) => {
        switch (step) {
          case "parse":
            return { ...prev, parsed: e.data as Parsed };
          case "verify":
            return { ...prev, verify: e.data as Verify };
          case "rules":
            return { ...prev, rules: e.data as Rule[] };
          case "deadline":
            return { ...prev, deadline: e.data as Deadline };
          case "judge":
            return { ...prev, judgment: e.data as Judgment };
          case "draft":
            return { ...prev, drafts: e.data as Drafts };
          default:
            return prev;
        }
      });
    }
  }, []);

  const start = useCallback(async () => {
    const text = input.trim();
    if (text.length < 20 && images.length === 0) {
      setInputError("청구 메일이나 카드 문자 내용을 20자 이상 붙여넣거나 사진을 첨부해 주세요.");
      return;
    }
    setInputError(null);
    setSteps(initialSteps());
    setResults({});
    setFatal(null);
    setTab("email");
    setCopied(null);
    setPhase("result");
    setRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          images: images.map((im) => ({ mime: im.mime, data: im.data })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let msg = "판정을 시작하지 못했습니다.";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setFatal(msg);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            try {
              applyEvent(JSON.parse(line.slice(5).trim()));
            } catch {
              /* 손상된 이벤트는 건너뜀 */
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setFatal("서버와 연결이 끊겼습니다. 다시 시도해 주세요.");
      }
    } finally {
      setRunning(false);
    }
  }, [input, images, applyEvent]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("input");
    setRunning(false);
    setFatal(null);
    setSteps(initialSteps());
    setResults({});
  }, []);

  const copy = useCallback(async (which: DocTab, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  }, []);

  if (phase === "input") {
    return (
      <main className="input-screen">
        <div className="input-box">
          <h1>해외결제 청구 메일과 카드 문자를 붙여넣으세요.</h1>
          <p className="sub">
            발신자 진위, 결제 상태, 적용 규정, 이의신청 기한, 제기 경로를 판정하고 영문 이의제기 메일·카드사 진술서·타임라인을
            만듭니다. 보내는 것은 직접 합니다.
          </p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="청구 메일, 카드 문자, 내 상황"
            spellCheck={false}
          />
          <div className="attach">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={images.length >= MAX_IMAGES}
            >
              사진 추가
            </button>
            <span className="attach-hint">
              청구 메일·카드 문자·콘솔 화면 캡처를 최대 {MAX_IMAGES}장까지. 글자가 읽히는 크기로.
            </span>
            {images.length > 0 && (
              <ul className="thumbs">
                {images.map((im) => (
                  <li key={im.id} className="thumb">
                    <img src={im.preview} alt={im.name} />
                    <button type="button" className="thumb-remove" onClick={() => removeImage(im.id)}>
                      빼기
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {inputError && <p className="error">{inputError}</p>}
          <div className="input-actions">
            <button type="button" className="btn-primary" onClick={start}>
              판정 시작
            </button>
          </div>
          <div className="chips">
            <span className="chips-label">예시로 해보기</span>
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                onClick={() => {
                  setInput(s.text);
                  setInputError(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const { parsed, verify, rules, deadline, judgment, drafts } = results;
  const issuerRoute = judgment?.routes.find((r) => r.name === "issuer");
  const sortedRoutes = judgment ? [...judgment.routes].sort((a, b) => a.priority - b.priority) : [];

  return (
    <main className="result-screen">
      <div className="result-top">
        <h1>판정 결과</h1>
        <button type="button" className="btn-secondary" onClick={reset}>
          다른 건 판정하기
        </button>
      </div>

      {/* 1. 입력 원문 요약 */}
      <section>
        <details className="raw">
          <summary>
            {parsed
              ? `입력 원문 · ${parsed.merchant ?? "가맹점 미확인"} · ${parsed.amounts.length}건 거래`
              : "입력 원문"}
            {images.length > 0 ? ` · 사진 ${images.length}장` : ""}
          </summary>
          {images.length > 0 && (
            <ul className="thumbs">
              {images.map((im) => (
                <li key={im.id} className="thumb">
                  <img src={im.preview} alt={im.name} />
                </li>
              ))}
            </ul>
          )}
          {parsed?.image_summary && <p className="image-summary">사진에서 읽은 내용: {parsed.image_summary}</p>}
          {input && <pre>{input}</pre>}
        </details>
      </section>

      {/* 2. 판정 과정 */}
      <section>
        <h2>판정 과정</h2>
        <ol className="steps" aria-live="polite">
          {STEP_ORDER.map((s) => {
            const st = steps[s.key];
            return (
              <li key={s.key} className={`step ${st.status}`}>
                <span className="dot" aria-hidden="true" />
                <span className="name">{s.label}</span>
                {st.note && <span className="note">{st.note}</span>}
              </li>
            );
          })}
        </ol>
        {fatal && <p className="fatal" style={{ marginTop: 14 }}>{fatal}</p>}
      </section>

      {/* 3. 결론 */}
      <section>
        <h2>결론</h2>
        {judgment ? (
          <div className="verdict">
            <p className="headline">{judgment.headline}</p>
            <p className="state">{judgment.payment_state}</p>
            <div className="deadline">
              {deadline ? (
                <>
                  <span className={`d ${deadline.safe_left <= 30 ? "warn" : ""}`}>
                    D-{deadline.safe_left}
                  </span>
                  <span className="basis">
                    {deadline.basis} · 최대 기한 D-{deadline.max_left}
                  </span>
                </>
              ) : (
                <>
                  <span className="d none">기한 없음</span>
                  <span className="basis">
                    {issuerRoute?.reason ?? "승인 완료된 거래가 없어 카드사 이의신청 기한이 적용되지 않습니다."}
                  </span>
                </>
              )}
            </div>
            {judgment.immediate_actions.length > 0 && (
              <ul className="actions">
                {judgment.immediate_actions.map((a, i) => (
                  <li key={i}>
                    <span className={`badge ${a.urgency}`}>{URGENCY_LABEL[a.urgency] ?? a.urgency}</span>
                    <div>
                      <div className="action">{a.action}</div>
                      <div className="why">{a.why}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="placeholder">{running ? "판정 중입니다." : "판정 결과가 없습니다."}</p>
        )}
      </section>

      {/* 4. 어디에 제기할 수 있나 */}
      <section>
        <h2>어디에 제기할 수 있나</h2>
        {judgment ? (
          <div className="routes">
            {sortedRoutes.map((r) => (
              <div key={r.name} className={`route ${r.applicable ? "" : "na"}`}>
                <span className="num" aria-hidden="true">
                  {r.applicable ? r.priority : "–"}
                </span>
                <div>
                  <div className="head">
                    <span className="label">{r.label}</span>
                    {!r.applicable && <span className="na-tag">해당 없음</span>}
                    {r.applicable && r.reason_code && <span className="code">사유코드 {r.reason_code}</span>}
                  </div>
                  <p className="reason">{r.reason}</p>
                  {r.applicable && (
                    <div className="evidence">
                      <div>
                        <h3>갖고 있는 증빙</h3>
                        {r.evidence_have.length ? (
                          <ul>
                            {r.evidence_have.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty">없음</p>
                        )}
                      </div>
                      <div>
                        <h3>더 필요한 증빙</h3>
                        {r.evidence_missing.length ? (
                          <ul>
                            {r.evidence_missing.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="empty">없음</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="placeholder">경로 판정을 기다리는 중입니다.</p>
        )}
      </section>

      {/* 5. 보낼 서류 */}
      <section>
        <h2>보낼 서류</h2>
        {drafts ? (
          <>
            <div className="tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === "email"}
                onClick={() => setTab("email")}
              >
                영문 메일
              </button>
              <button
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === "statement"}
                onClick={() => setTab("statement")}
              >
                카드사 진술서
              </button>
              <button
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === "timeline"}
                onClick={() => setTab("timeline")}
              >
                타임라인
              </button>
            </div>

            {tab === "email" && (
              <div className="doc" role="tabpanel">
                <pre>{drafts.merchant_email_en}</pre>
                <div className="doc-foot">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => copy("email", drafts.merchant_email_en)}
                  >
                    {copied === "email" ? "복사됨" : "복사"}
                  </button>
                  <span className="hint">
                    한 통으로 보내세요. 여러 부서에 나눠 보내면 티켓이 흩어집니다.
                  </span>
                </div>
              </div>
            )}

            {tab === "statement" && (
              <div className="doc" role="tabpanel">
                <pre>{drafts.issuer_statement_ko}</pre>
                <div className="doc-foot">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => copy("statement", drafts.issuer_statement_ko)}
                  >
                    {copied === "statement" ? "복사됨" : "복사"}
                  </button>
                  <span className="hint">
                    {issuerRoute?.applicable
                      ? "카드사 앱이나 고객센터의 해외 이의신청 양식에 옮겨 적으세요. 양식은 카드사마다 다릅니다."
                      : "지금은 접수할 수 없습니다. 승인이 발생하면 이 골격을 채워 접수하세요."}
                  </span>
                </div>
              </div>
            )}

            {tab === "timeline" && (
              <div className="doc" role="tabpanel">
                <ul className="timeline">
                  {drafts.timeline.map((t, i) => (
                    <li key={i}>
                      <span className="date">{t.date}</span>
                      <span>{t.event}</span>
                      <span className="src">{SOURCE_TAG[t.source] ?? t.source}</span>
                    </li>
                  ))}
                </ul>
                <div className="doc-foot">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      copy(
                        "timeline",
                        drafts.timeline
                          .map((t) => `${t.date}  ${t.event}  (${SOURCE_TAG[t.source] ?? t.source})`)
                          .join("\n"),
                      )
                    }
                  >
                    {copied === "timeline" ? "복사됨" : "복사"}
                  </button>
                  <span className="hint">메일과 진술서 양쪽에 같은 타임라인을 붙이면 사실관계가 어긋나지 않습니다.</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="placeholder">서류 작성을 기다리는 중입니다.</p>
        )}
      </section>

      {/* 6. 판정에 쓴 규정 */}
      <section>
        <h2>판정에 쓴 규정</h2>
        {rules && rules.length > 0 ? (
          <div className="rules">
            {rules.map((r) => (
              <div key={r.id} className="rule">
                <div className="rule-head">
                  <span className="rule-title">{r.title}</span>
                  {r.verify && <span className="verify">원문 확인 필요</span>}
                </div>
                <p className="rule-body">{r.body}</p>
                <p className="rule-src">
                  출처: {SOURCE_LABEL[r.source]} · {r.id}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="placeholder">{rules ? "일치하는 규정이 없습니다." : "규정 검색을 기다리는 중입니다."}</p>
        )}
      </section>

      {/* 7. 하단 고지 */}
      <footer className="notice">
        <ul>
          <li>이 판정은 법률 자문이 아닙니다. 규정 요약은 참고용이며 원문과 다를 수 있습니다.</li>
          <li>카드사 이의신청은 접수 전에 카드사에 기한·서류·양식을 확인하세요.</li>
          <li>승인 시도가 반복되면 이 화면보다 카드사 고객센터 전화가 먼저입니다.</li>
        </ul>
      </footer>
    </main>
  );
}
