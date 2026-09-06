'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SAMPLES } from '@/lib/samples';
import { CASE_LABEL, EMPTY_SLOTS, PAYMENT_LABEL, SIGNAL_LABEL, combineSlots, maskText, ParsedSchema, ReportSchema, deadlineFor, type CaseResult, type Slots } from '@/lib/case';
import { searchRules, verifySender } from '@/lib/rules';
import { REASON_CODES, autoChecked, buildPlan, evidenceFor, issuerForm, lookupMerchant, readiness as computeReadiness, referenceDeadline } from '@/lib/playbook';
import { ISSUERS, VERIFIED_LABEL, findIssuer, issuerReasonFor } from '@/lib/knowledge';
import { buildReferences } from '@/lib/references';
import { MAX_IMAGES, downscaleImage, isImageFile, type ImageInput } from '@/lib/images';
import { TRANSCRIPT_HEADER } from '@/lib/agent';
import { Icon } from '@/components/Icon';
import { Landing } from '@/components/Landing';
import { Workspace } from '@/components/Workspace';
import { LoadingOverlay, ReviewDialog, Toast } from '@/components/Overlays';

const STORE = 'subcut-case-v1';

export default function Page() {
  const [slots, setSlots] = useState<Slots>(EMPTY_SLOTS);
  const [images, setImages] = useState<ImageInput[]>([]);
  const [history, setHistory] = useState('');
  const [followup, setFollowup] = useState('');
  const [result, setResult] = useState<CaseResult | null>(null);
  const [previous, setPrevious] = useState<CaseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadStage, setLoadStage] = useState(0);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [review, setReview] = useState<string | null>(null);
  const scrollTo = useRef<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [txDate, setTxDate] = useState('');
  const [issuerId, setIssuerId] = useState('');
  const [revision, setRevision] = useState(1);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const abort = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const stored = JSON.parse(raw);
        if (!stored.expires || stored.expires < Date.now()) localStorage.removeItem(STORE); else setSaved(true);
      }
    } catch { try { localStorage.removeItem(STORE); } catch {} }
    const wanted = new URLSearchParams(window.location.search).get('case');
    const idx = wanted ? SAMPLES.findIndex(x => x.id === wanted) : -1;
    if (idx >= 0) openSample(idx);
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (idx >= 0 && tab && /^[a-z-]+$/.test(tab)) scrollTo.current = tab;
    // 브라우저 뒤로가기로도 첫 화면으로 돌아간다.
    const onPop = () => { if (!window.history.state?.view) reset(false); };
    window.addEventListener('popstate', onPop);
    return () => { abort.current?.abort(); window.removeEventListener('popstate', onPop); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!result) return;
    if (window.history.state?.view !== 'case') window.history.pushState({ view: 'case' }, '', window.location.href);
    const id = scrollTo.current;
    scrollTo.current = null;
    if (id) { setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50); return; }
    window.scrollTo({ top: 0 });
  }, [result]);

  const combined = useMemo(() => combineSlots(slots), [slots]);
  const merchant = useMemo(() => result ? lookupMerchant(result.parsed.descriptor, result.parsed.merchant) : null, [result]);
  const issuer = useMemo(() => ISSUERS.find(i => i.id === issuerId) ?? null, [issuerId]);
  const plan = useMemo(() => result ? buildPlan(result.parsed, merchant, result.report.actions, issuer) : [], [result, merchant, issuer]);
  const mapping = result ? REASON_CODES[result.parsed.caseType] : null;
  const evidence = useMemo(() => result ? evidenceFor(result.parsed.caseType) : [], [result]);
  const deadlineRef = useMemo(() => referenceDeadline(txDate || null), [txDate]);
  const readiness = useMemo(() => computeReadiness(evidence, Object.fromEntries(evidence.map(i => [i.id, !!checks[`ev:${i.id}`]]))), [evidence, checks]);
  const form = useMemo(() => result ? issuerForm(result.parsed, merchant, mapping, result.report.drafts.timeline, issuer) : [], [result, merchant, mapping, issuer]);

  function applyResult(data: CaseResult, text: string, opts: { keepChecks?: boolean; checks?: Record<string, boolean>; txDate?: string; issuerId?: string } = {}) {
    const auto = Object.fromEntries(Object.entries(autoChecked(data.parsed)).map(([k, v]) => [`ev:${k}`, v]));
    const noPosting = data.parsed.paymentStatus === 'declined' || data.parsed.paymentStatus === 'invoice_only';
    const fullText = data.transcript && !text.includes(TRANSCRIPT_HEADER) ? `${text}\n\n${TRANSCRIPT_HEADER}\n${data.transcript}` : text;
    setResult(data);
    setHistory(fullText);
    setChecks(prev => ({ ...auto, ...(opts.keepChecks ? prev : {}), ...(opts.checks || {}) }));
    setTxDate(opts.txDate ?? (noPosting ? '' : data.parsed.transactionDate || ''));
    if (opts.issuerId !== undefined) setIssuerId(opts.issuerId);
    else setIssuerId(prev => prev || findIssuer(fullText)?.id || '');
    setFollowup('');
    setError('');
  }
  function reset(viaHistory = true) {
    abort.current?.abort();
    if (viaHistory && window.history.state?.view === 'case') window.history.back();
    else window.history.replaceState(null, '', window.location.pathname);
    setBusy(false); setResult(null); setPrevious(null); setRevision(1); setError(''); setSlots(EMPTY_SLOTS); setImages([]); setHistory(''); setFollowup(''); setChecks({}); setTxDate(''); setIssuerId('');
  }
  function openSample(index: number) {
    const s = SAMPLES[index];
    setPrevious(null); setRevision(1);
    applyResult(structuredClone(s.result), s.text, { issuerId: s.issuerId });
    setSlots({ ...s.slots });
  }
  function prepare(text: string) {
    if (text.trim().length < 20 && images.length === 0) { setError('카드 문자나 상황 설명을 20자 이상 적거나 사진을 올려 주세요.'); return; }
    if (text.length > 20000) { setError('한 사건은 20,000자까지만 넣을 수 있어요. 나눠서 올려 주세요.'); return; }
    setError('');
    setReview(maskText(text));
  }
  async function analyze(text: string) {
    setReview(null); setBusy(true); setLoadStage(0); setProgress('사건의 단서를 읽고 있어요'); setError('');
    const controller = new AbortController();
    abort.current = controller;
    let finished = false;
    try {
      const attached = images; // 후속 분석에도 새로 붙인 사진만 보낸다. 이전 사진은 옮겨 적은 글로 history에 있다.
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text, issuerId: issuerId || undefined, images: attached.length ? attached : undefined }), signal: controller.signal });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || '분석을 시작하지 못했어요.'); }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('분석 연결을 확인해 주세요.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const part = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!part.startsWith('data: ')) continue;
          const event = JSON.parse(part.slice(6));
          if (event.step === 'error') throw new Error(event.note);
          if (event.step === 'final') {
            const data = event.data as CaseResult;
            ParsedSchema.parse(data.parsed); ReportSchema.parse(data.report);
            if (result) { setPrevious(result); setRevision(n => n + 1); }
            applyResult(data, text, { keepChecks: !!result, txDate: result && txDate ? txDate : undefined });
            setImages([]);
           
            finished = true;
          } else {
            setLoadStage(event.step === 'parse' ? 0 : event.step === 'connect' ? 1 : 2);
            setProgress(event.note);
          }
        }
      }
      if (!finished) throw new Error('연결이 끊겼어요. 입력은 그대로 있으니 다시 시도해 주세요.');
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '분석 중에 문제가 생겼어요.');
    } finally { setBusy(false); }
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ result, history, slots, revision, checks, txDate, issuerId, expires: Date.now() + 7 * 86400000 }));
      setSaved(true);
      setToast('이 브라우저에 7일간 저장했어요. 체크 상태도 같이 저장돼요.');
    } catch { setToast('브라우저 저장 공간을 쓸 수 없어요.'); }
  }
  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE) || '{}');
      if (!data.expires || data.expires < Date.now()) throw new Error();
      const parsed = ParsedSchema.parse(data.result.parsed);
      const report = ReportSchema.parse({ basis: [], ...data.result.report });
      const savedIssuer = ISSUERS.find(i => i.id === data.issuerId) ?? null;
      const references = Array.isArray(data.result.references) && data.result.references.length ? data.result.references : buildReferences(parsed, savedIssuer);
      const restored: CaseResult = { parsed, report, rules: searchRules(parsed.caseType), references, verification: verifySender(parsed.senderDomain), deadline: deadlineFor(parsed.paymentStatus), mode: data.result.mode === 'demo' ? 'demo' : 'live' };
      setPrevious(null); setRevision(Number(data.revision) || 1);
      applyResult(restored, String(data.history || '').slice(0, 20000), { checks: data.checks || {}, txDate: typeof data.txDate === 'string' ? data.txDate : undefined, issuerId: typeof data.issuerId === 'string' ? data.issuerId : '' });
      if (data.slots && typeof data.slots === 'object') setSlots({ ...EMPTY_SLOTS, ...data.slots });
    } catch { localStorage.removeItem(STORE); setSaved(false); setToast('저장한 사건이 만료됐거나 열 수 없어요.'); }
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setToast(`${label}을(를) 복사했어요.`); }
    catch { setToast('복사 권한이 없어요. 내용을 직접 골라서 복사해 주세요.'); }
  }
  function exportMarkdown() {
    if (!result) return;
    const { parsed, report } = result;
    const lines = [
      `# ${parsed.title}`, '',
      result.mode === 'demo' ? '> 미리 만든 예시 · 실제 분석 아님' : '> 구독컷 분석 결과 · 검토용',
      '', `- 가맹점: ${merchant ? merchant.name : parsed.merchant || '미확인'}${parsed.descriptor ? ` (표기 ${parsed.descriptor})` : ''}`,
      `- 금액: ${parsed.amount || '확인 필요'}`, `- 거래 상태: ${PAYMENT_LABEL[parsed.paymentStatus]}`, `- 유형: ${CASE_LABEL[parsed.caseType]}`,
      `- 참고 기한: ${deadlineRef ? `${deadlineRef.due} (D${deadlineRef.daysLeft < 0 ? '+' : '-'}${Math.abs(deadlineRef.daysLeft)}) · 카드사 확인 필요` : '기준일 확인 필요'}`,
      '', '## 판단 요약', report.headline, '', report.explanation,
      ...(report.basis.length ? ['', '### 판단 근거', ...report.basis.map(b => { const ref = result.references.find(r => r.id === b.refId); return `- ${b.point}${ref ? ` · [${ref.title}](${ref.url})` : ''}`; })] : []),
      '', '## 탐지된 신호', ...(parsed.signals.length ? parsed.signals.map(s => `- ${SIGNAL_LABEL[s.kind]}: "${s.evidence}"`) : ['- 없음']),
      '', '## 확인한 사실', ...parsed.facts.map(f => `- ${f.label}: ${f.value}\n  > ${f.quote}`),
      '', '## 확인할 질문', ...report.questions.map(q => `- ${q.question} (${q.why})`),
      '', '## 24시간 계획',
      ...plan.flatMap(ph => [`### ${ph.window} · ${ph.title}`, ...ph.steps.map(s => `- [${checks[`${ph.id}:${s.id}`] ? 'x' : ' '}] ${s.title}${s.source === 'ai' ? ' (AI 제안)' : ''}: ${s.detail}${s.link ? ` (${s.link.url})` : ''}`), '']),
      '## 사유코드 후보', mapping ? `- Visa ${mapping.visa.code} ${mapping.visa.name}\n- Mastercard ${mapping.mastercard.code} ${mapping.mastercard.name}\n- ${mapping.summary}\n- 주의: ${mapping.caution}` : '- 유형 미확정',
      '', `## 증빙 체크리스트 (${readiness.done}/${readiness.total})`, ...evidence.map(i => `- [${checks[`ev:${i.id}`] ? 'x' : ' '}] ${i.label} · ${i.hint}`),
      '', '## 카드사 이의신청서 항목', ...form.map(f => `- ${f.label}: ${f.value}`),
      ...(issuer ? [
        '', `## ${issuer.name} 해외이용 이의신청 안내 (${VERIFIED_LABEL[issuer.verified]}, 조회 ${issuer.sources[0]?.accessed ?? ''})`,
        `- 고객센터: ${issuer.phone}`,
        ...issuer.channels.map(c => `- 채널: ${c.label}${c.url ? ` (${c.url})` : ''}`),
        `- 기한 안내: ${issuer.deadline}`,
        `- 처리 기간: ${issuer.processing}`,
        ...(issuerReasonFor(issuer, parsed.caseType) ? [`- 이 사건의 사유 명칭: ${issuerReasonFor(issuer, parsed.caseType)}`] : []),
        ...(issuer.documents.length ? [`- 서류: ${issuer.documents.join(' / ')}`] : []),
        ...issuer.notes.map(n => `- 유의: ${n}`),
        ...issuer.sources.map(s => `- 출처: [${s.title}](${s.url})`),
      ] : []),
      '', '## 영문 문의 초안', '```', report.drafts.email, '```',
      '', '## 국문 사실 정리', '```', report.drafts.statement, '```',
      '', '## 타임라인', '```', report.drafts.timeline, '```',
      '', '## 참고 자료', ...result.rules.map(r => `- [${r.title}](${r.url}) · ${r.publisher} · ${r.scope}`),
      ...(merchant ? [
        '', `## ${merchant.name} 정책 요약 (${VERIFIED_LABEL[merchant.verified]}, 조회 ${merchant.sources[0]?.accessed ?? ''})`,
        `- 환불 조건: ${merchant.refund}`, `- 해지 규칙: ${merchant.cancellation}`, `- 미승인·오청구 창구: ${merchant.unauthorized}`,
        ...(merchant.processingTime ? [`- 환불 처리 기간: ${merchant.processingTime}`] : []),
        ...merchant.notes.map(n => `- 유의: ${n}`),
        ...merchant.links.map(l => `- [${merchant.name} · ${l.label}](${l.url})`),
        ...merchant.sources.map(s => `- 출처: [${s.title}](${s.url})`),
      ] : []),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = '구독컷_이의신청_패키지.md'; a.click();
    URL.revokeObjectURL(url);
  }
  async function upload(files: File[]) {
    setError('');
    let added = 0;
    for (const file of files) {
      if (isImageFile(file)) {
        if (images.length + added >= MAX_IMAGES) { setError(`사진은 ${MAX_IMAGES}장까지 올릴 수 있어요.`); break; }
        try {
          const img = await downscaleImage(file);
          setImages(list => list.length >= MAX_IMAGES ? list : [...list, img]);
          added += 1;
        } catch { setError('사진을 읽지 못했어요. JPG, PNG, WEBP 파일인지 확인해 주세요.'); }
        continue;
      }
      if (file.size > 80000) { setError('텍스트 파일은 80KB까지 넣을 수 있어요.'); continue; }
      const t = await file.text();
      if (combined.length + t.length > 20000) { setError('전체 입력이 20,000자를 넘었어요.'); continue; }
      setSlots(s => ({ ...s, mail: s.mail + (s.mail ? '\n\n' : '') + t }));
    }
  }
  function toggle(id: string) { setChecks(c => ({ ...c, [id]: !c[id] })); }
  function answer(question: string) {
    setFollowup(`${question}\n답변: `);
    document.querySelector<HTMLTextAreaElement>('.followup textarea')?.focus();
  }

  return (
    <>
      <header className="masthead">
        <div className="masthead__in">
          <button className="brand" onClick={() => reset()} aria-label="구독컷 홈"><span className="brand__mark">구독<span>컷</span></span><span className="brand__service">해외 구독 이상청구 대응</span></button>
          <div className="masthead__status">
            {result ? (
              <>
                <span className="masthead__confirmed"><i className={`masthead__dot ${result.mode}`} />{result.mode === 'demo' ? '예시' : '분석 완료'}<span className="long"> · {result.parsed.merchant || '사건'} · v{revision}</span></span>
                <div className="masthead__actions">
                  <button className="ghostbtn small" onClick={() => reset()}>← 처음으로</button>
                  <button className="ghostbtn small" onClick={save}><Icon name="download" size={13} /> 저장</button>
                  {saved && <button className="ghostbtn small" onClick={() => { localStorage.removeItem(STORE); setSaved(false); setToast('이 브라우저에 저장한 사건을 지웠어요.'); }}>저장본 삭제</button>}
                  <button className="ghostbtn small" onClick={exportMarkdown}>내보내기 →</button>
                </div>
              </>
            ) : <span className="masthead__confirmed"><i className="masthead__dot" />첫 24시간</span>}
          </div>
        </div>
      </header>

      {!result ? (
        <Landing slots={slots} setSlot={(k, v) => setSlots(s => ({ ...s, [k]: v }))} onSubmit={() => prepare(combined)} onSample={openSample} onUpload={upload} images={images} onRemoveImage={i => setImages(list => list.filter((_, j) => j !== i))} saved={saved} onRestore={restore} error={error} busy={busy} canSubmit={combined.trim().length >= 20 || images.length > 0} />
      ) : (
        <Workspace
          result={result} revision={revision} previous={previous} onDismissPrevious={() => setPrevious(null)}
          merchant={merchant} plan={plan} mapping={mapping} evidence={evidence}
          checks={checks} toggle={toggle} txDate={txDate} setTxDate={setTxDate} deadlineRef={deadlineRef} readiness={readiness} form={form}
          issuer={issuer} issuerId={issuerId} setIssuerId={setIssuerId}
          followup={followup} setFollowup={setFollowup} onFollowup={() => prepare(`${history}\n\n[추가 자료 / 사용자의 새 설명]\n${followup.trim() || '(첨부 사진 참고)'}`)}
          images={images} onUpload={upload} onRemoveImage={i => setImages(list => list.filter((_, j) => j !== i))}
          busy={busy} error={error} onAnswer={answer} onCopy={copy} onExport={exportMarkdown}
        />
      )}

      {busy && <LoadingOverlay stage={loadStage} progress={progress} onCancel={() => { abort.current?.abort(); setBusy(false); }} />}
      <ReviewDialog review={review} setReview={setReview} onConfirm={() => review !== null && analyze(maskText(review))} onClose={() => setReview(null)} images={images} />
      <Toast text={toast} />
    </>
  );
}
