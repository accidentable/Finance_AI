'use client';

import { useEffect, useRef, useState } from 'react';
import { SAMPLES } from '@/lib/samples';
import { maskText, ParsedSchema, ReportSchema, PAYMENT_LABEL, type CaseResult } from '@/lib/case';
import { searchRules, verifySender } from '@/lib/rules';
import { deadlineFor } from '@/lib/case';

type IconName = 'arrow' | 'plus' | 'close' | 'file' | 'mail' | 'link' | 'check' | 'search' | 'zoom' | 'fit' | 'download' | 'clock' | 'board' | 'chevron' | 'shield';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>, plus: <path d="M12 5v14M5 12h14" />, close: <path d="m6 6 12 12M18 6 6 18" />,
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16h14V8zM14 3v5h5M8 12h8M8 16h5" /></>, mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    link: <><path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)" /></>,
    check: <path d="m5 12 4 4L19 6" />, search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>, zoom: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5M7 10h6M10 7v6" /></>,
    fit: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />, download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, board: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    chevron: <path d="m9 5 7 7-7 7" />, shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 11 3 3 5-5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Mark() { return <span className="brand-mark"><span /><span /><span /></span>; }
type Position = { x: number; y: number };
type Node = { id: string; kind: 'fact' | 'case' | 'question' | 'action' | 'source'; title: string; label: string; text: string; index?: number; width: number; height: number; pos: Position };
const STORE = 'dispute72-case-v2';
const STAGES = ['단서 읽기', '연결 확인', '초안 정리'];

export default function Page() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState('');
  const [followup, setFollowup] = useState('');
  const [result, setResult] = useState<CaseResult | null>(null);
  const [previous, setPrevious] = useState<CaseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [examples, setExamples] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'board' | 'timeline'>('board');
  const [doc, setDoc] = useState<'email' | 'statement' | 'timeline' | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [revision, setRevision] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | undefined>(undefined);
  const upload = useRef<HTMLInputElement>(null);
  const moved = useRef(false);
  const drag = useRef<{ id: string; x: number; y: number; origin: Position } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reviewRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { try { const raw = localStorage.getItem(STORE); if (raw) { const stored = JSON.parse(raw); if (!stored.expires || stored.expires < Date.now()) localStorage.removeItem(STORE); else setSaved(true); } } catch { try { localStorage.removeItem(STORE); } catch {} } return () => abort.current?.abort(); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { setCopied(false); if (doc) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [doc]);
  useEffect(() => { if (review !== null) reviewRef.current?.showModal(); else reviewRef.current?.close(); }, [review]);
  function fit() {
    if (!viewport.current) return;
    const { width, height } = viewport.current.getBoundingClientRect();
    const extra = Math.floor(Math.max(0, (result?.parsed.facts.length || 1) - 1) / 3) * 300;
    const z = Math.max(.3, Math.min((width - 60) / (1240 + extra), (height - 95) / 600, 1.15));
    setZoom(z); setPan({ x: (width - (1240 + extra) * z) / 2 + extra * z, y: Math.max(12, (height - 600 * z - 70) / 2) });
  }
  useEffect(() => { if (!result || !viewport.current) return; const ro = new ResizeObserver(fit); ro.observe(viewport.current); fit(); return () => ro.disconnect(); }, [!!result, tab]);
  function reset() {
    abort.current?.abort(); setBusy(false); setResult(null); setPrevious(null); setSelected(null); setPositions({}); setRevision(1); setError(''); setInput(''); setHistory(''); setFollowup('');
  }
  function openSample(index: number) {
    const s = SAMPLES[index]; setResult(structuredClone(s.result)); setHistory(s.text); setInput(s.text); setExamples(false); setPositions({}); setSelected(null); setRevision(1); setPrevious(null); setError('');
  }
  function prepare(text: string) {
    if (text.trim().length < 20) { setError('메일이나 상황을 20자 이상 적어 주세요.'); return; }
    if (text.length > 20000) { setError('한 사건의 내용은 20,000자 이내로 나누어 주세요.'); return; }
    setError(''); setReview(maskText(text));
  }
  async function analyze(text: string) {
    setReview(null); setBusy(true); setStage(0); setProgress('사건의 단서를 읽고 있습니다'); setError('');
    const controller = new AbortController(); abort.current = controller;
    let finished = false;
    try {
      const response = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: text }), signal: controller.signal });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error || '분석을 시작하지 못했습니다.'); }
      const reader = response.body?.getReader(); if (!reader) throw new Error('분석 연결을 확인해 주세요.');
      const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const part = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          if (!part.startsWith('data: ')) continue;
          const event = JSON.parse(part.slice(6));
          if (event.step === 'error') throw new Error(event.note);
          if (event.step === 'final') {
            const data = event.data as CaseResult; ParsedSchema.parse(data.parsed); ReportSchema.parse(data.report);
            if (result) { setPrevious(result); setRevision(n => n + 1); }
            setResult(data); setHistory(text); setFollowup(''); setSelected(null); finished = true;
          } else { setStage(event.step === 'parse' ? 0 : event.step === 'connect' ? 1 : 2); setProgress(event.note); }
        }
      }
      if (!finished) throw new Error('연결이 중단됐습니다. 입력을 유지했으니 다시 시도해 주세요.');
    } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.'); }
    finally { setBusy(false); }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify({ result, history, revision, expires: Date.now() + 7 * 86400000 })); setSaved(true); setToast('이 브라우저에 7일간 저장했어요. 새 분석 후 다시 저장해 주세요.'); }
    catch { setToast('브라우저 저장 공간을 사용할 수 없습니다.'); }
  }
  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE) || '{}');
      if (!data.expires || data.expires < Date.now()) throw new Error();
      const parsed = ParsedSchema.parse(data.result.parsed); const report = ReportSchema.parse(data.result.report);
      setResult({ parsed, report, rules: searchRules(parsed.caseType), verification: verifySender(parsed.senderDomain), deadline: deadlineFor(parsed.paymentStatus), mode: data.result.mode === 'demo' ? 'demo' : 'live' });
      setHistory(String(data.history || '').slice(0,20000)); setRevision(Number(data.revision) || 1);
    } catch { localStorage.removeItem(STORE); setSaved(false); setToast('저장된 사건이 만료되었거나 열 수 없습니다.'); }
  }
  function download() {
    if (!result) return;
    const text = `# ${result.parsed.title}\n\n${result.mode === 'demo' ? '합성 예시 · 실제 분석 아님\n\n' : ''}${result.parsed.summary}\n\n## 확인할 질문\n${result.report.questions.map(q => '- ' + q.question).join('\n')}\n\n## 영문 메일 초안\n${result.report.drafts.email}\n\n## 상담용 사실 정리\n${result.report.drafts.statement}\n\n## 타임라인\n${result.report.drafts.timeline}\n\n## 참고 자료\n${result.rules.map(r => `[${r.title}](${r.url}) — ${r.scope}`).join('\n')}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = '분쟁72_사건정리.md'; a.click(); URL.revokeObjectURL(url);
  }
  const nodes: Node[] = result ? [
    ...result.parsed.facts.map((f, i) => ({ id: `fact-${i}`, kind: 'fact' as const, title: f.label, label: `단서 ${String(i + 1).padStart(2, '0')}`, text: f.value, index: i, width: 270, height: 146, pos: { x: 30 + Math.floor(i / 3) * -300, y: 60 + (i % 3) * 160 } })),
    { id: 'case', kind: 'case', title: result.parsed.title, label: '사건의 중심', text: result.parsed.summary, width: 338, height: 240, pos: { x: 430, y: 140 } },
    { id: 'question', kind: 'question', title: '아직 연결되지 않은 단서', label: '추가 확인', text: result.report.questions[0]?.question || '추가 질문이 없습니다. 사실관계를 검토해 주세요.', width: 338, height: 142, pos: { x: 430, y: 418 } },
    { id: 'action', kind: 'action', title: '이제, 이렇게 해보세요', label: '다음 행동', text: '', width: 300, height: 290, pos: { x: 900, y: 60 } },
    { id: 'source', kind: 'source', title: '판단을 뒷받침하는 자료', label: '연결된 근거', text: '', width: 300, height: 185, pos: { x: 900, y: 380 } },
  ] : [];
  const pos = (n: Node) => positions[n.id] || n.pos;
  const activeNode = nodes.find(n => n.id === selected);
  const edges = nodes.filter(n => n.id !== 'case').map(n => ({ from: n.id === 'source' ? 'action' : 'case', to: n.id, label: n.kind === 'fact' ? '확인한 사실' : n.kind === 'question' ? '더 필요한 정보' : n.kind === 'source' ? '참고 근거' : '이어지는 행동' }));
  function pointerDown(e: React.PointerEvent, id: string, origin: Position) { moved.current = false; if (e.button !== 0 || window.innerWidth <= 640) return; drag.current = { id, x: e.clientX, y: e.clientY, origin }; e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation(); }
  function pointerMove(e: React.PointerEvent) { const d = drag.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true; if (d.id === 'canvas') setPan({ x: d.origin.x + dx, y: d.origin.y + dy }); else setPositions(p => ({ ...p, [d.id]: { x: d.origin.x + dx / zoom, y: d.origin.y + dy / zoom } })); }

  return <>
    <header className="topbar"><button className="brand" onClick={reset} aria-label="분쟁72 홈"><Mark /><strong>분쟁<span>72</span></strong></button>
      {result ? <><div className="breadcrumb"><span>내 사건</span><Icon name="chevron" size={13} /><b>{result.parsed.merchant || '새로운 사건'}</b><span className="version">v{revision}</span></div><div className="header-actions"><span className={`mode ${result.mode}`}>{result.mode === 'demo' ? '합성 예시' : 'OpenAI 분석'}</span><button className="quiet" onClick={save}><Icon name="download" size={15} /> 저장</button><button className="outline" onClick={download}>내보내기 <Icon name="arrow" size={14} /></button></div></> : <span className="header-caption">해외결제 문제를 풀어가는 공간</span>}
    </header>

    {!result ? <main className="landing"><div className="entry">
      <div className="entry-caption"><span className="tiny-dot" /> 복잡한 문제도, 하나의 단서부터</div>
      <h1>어떤 결제 문제가 있었나요?</h1>
      <form className="composer" onSubmit={e => { e.preventDefault(); prepare(input); }}>
        <textarea aria-label="사건 내용" value={input} onChange={e => setInput(e.target.value)} maxLength={20000} placeholder={'청구 메일이나 카드 알림을 붙여넣어 주세요.\n지금 겪고 있는 일을 편하게 적어도 좋아요.'} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); prepare(input); } }} />
        <div className="composer-bottom"><div className="composer-tools"><button type="button" className="icon-button" onClick={() => upload.current?.click()} aria-label="텍스트 파일 추가" title="텍스트 파일 추가 (.txt)"><Icon name="plus" /></button><span className="tool-divider" /><div className="examples-wrap"><button type="button" className="sample-button" onClick={() => setExamples(!examples)} aria-expanded={examples}><Icon name="search" size={15} /> 예시로 살펴보기 <span>⌄</span></button>{examples && <div className="examples-menu">{SAMPLES.map((s, i) => <button type="button" key={s.id} onClick={() => openSample(i)}><span>0{i + 1}</span>{s.label}<Icon name="arrow" size={14} /></button>)}<small>가상의 사건으로 보드 둘러보기 · API 호출 없음</small></div>}</div></div><button className="send" disabled={busy || input.trim().length < 20} aria-label="사건 분석 시작"><Icon name="arrow" size={20} /></button></div>
      </form>
      <div className="entry-foot"><span><Icon name="shield" size={13} /> 보내기 전에 내용을 확인할 수 있어요</span><span>Ctrl + Enter</span></div>
      {saved && <button className="resume" onClick={restore}><Icon name="clock" size={14} /> 저장한 사건 이어보기 <Icon name="arrow" size={14} /></button>}
      {error && <p className="error" role="alert">{error}</p>}
    </div><p className="landing-footer">첫 대응부터 증빙 정리까지. 발송과 접수는 직접 결정하세요.</p></main> : <main className="workspace">
      <aside className="rail"><button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')} aria-label="사건 보드" title="사건 보드"><Icon name="board" /></button><button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')} aria-label="타임라인" title="타임라인"><Icon name="clock" /></button><button onClick={() => setDoc('email')} aria-label="제출 초안" title="제출 초안"><Icon name="file" /></button><div className="rail-bottom"><button onClick={reset} aria-label="새 사건" title="새 사건"><Icon name="plus" /></button></div></aside>
      <section className="work-main">
        <div className="board-heading"><div><div className="eyebrow">CASE WORKSPACE <span>/ 0{revision}</span></div><h1>{tab === 'board' ? '흩어진 단서가, 하나의 이야기로.' : '사건의 흐름을 시간순으로.'}</h1><p>{tab === 'board' ? '단서를 눌러 살펴보고, 새로운 내용을 연결해 보세요.' : '입력에서 확인한 기록을 차례로 정리했어요.'}</p></div><button className="draft-button" onClick={() => setDoc('email')}><Icon name="file" size={16} /> 제출 초안 <span>3</span><Icon name="arrow" size={15} /></button></div>
        {previous && <div className="change-banner"><Icon name="link" size={14} /><span>새 단서로 갱신했어요 · {previous.parsed.paymentStatus !== result.parsed.paymentStatus ? `${PAYMENT_LABEL[previous.parsed.paymentStatus]} → ${PAYMENT_LABEL[result.parsed.paymentStatus]}` : `확인된 단서 ${previous.parsed.facts.length}개 → ${result.parsed.facts.length}개`}</span><button onClick={() => setPrevious(null)} aria-label="갱신 알림 닫기"><Icon name="close" size={13} /></button></div>}
        {tab === 'board' ? <div ref={viewport} className="board-viewport" onPointerDown={e => pointerDown(e, 'canvas', pan)} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
          <div className="canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <div className="zone-label" style={{ left: 30, top: 12 }}>01 <span>수집한 단서</span></div><div className="zone-label" style={{ left: 430, top: 12 }}>02 <span>사건 연결하기</span></div><div className="zone-label" style={{ left: 900, top: 12 }}>03 <span>다음 단계</span></div>
            <svg className="connections" width="1240" height="760" aria-hidden="true">{edges.map(edge => {
              const a = nodes.find(n => n.id === edge.from)!; const b = nodes.find(n => n.id === edge.to)!; const pa = pos(a), pb = pos(b); const vertical = b.id === 'question' || b.id === 'source';
              const x1 = pa.x + (vertical ? a.width / 2 : pb.x < pa.x ? 0 : a.width), y1 = pa.y + (vertical ? a.height : a.height / 2);
              const x2 = pb.x + (vertical ? b.width / 2 : pb.x < pa.x ? b.width : 0), y2 = pb.y + (vertical ? 0 : b.height / 2);
              const path = vertical ? `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}` : `M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
              return <g key={edge.to} className={`${selected && selected !== edge.from && selected !== edge.to ? 'dim' : ''} ${selected === edge.to || selected === edge.from ? 'connected' : ''}`}><path d={path} className={b.kind === 'question' ? 'dashed' : ''} /><circle cx={x1} cy={y1} r="3" /><circle cx={x2} cy={y2} r="3" />{b.kind !== 'fact' && <text x={(x1+x2)/2 + (vertical ? 12 : -18)} y={(y1+y2)/2 - (vertical ? 0 : 10)}>{edge.label}</text>}</g>;
            })}</svg>
            {nodes.map(n => <div key={n.id} className={`board-node ${n.kind} ${selected === n.id ? 'selected' : ''}`} style={{ left: pos(n).x, top: pos(n).y, width: n.width, minHeight: n.height }} role="button" tabIndex={0} aria-label={`${n.label}: ${n.title}`} onPointerDown={e => pointerDown(e, n.id, pos(n))} onPointerUp={e => { e.stopPropagation(); drag.current = null; }} onClick={() => { if (!moved.current) setSelected(n.id === selected ? null : n.id); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(n.id); } }}>
              <div className="node-top"><span className="node-icon"><Icon name={n.kind === 'fact' ? n.index === 0 ? 'mail' : 'file' : n.kind === 'case' ? 'link' : n.kind === 'question' ? 'search' : n.kind === 'action' ? 'check' : 'shield'} size={15} /></span><span>{n.label}</span><span className="node-menu">···</span></div>
              <h2>{n.title}</h2>
              {n.kind === 'case' ? <><div className="case-amount">{result.parsed.amount || '금액 확인 필요'}<span>{result.parsed.merchant || '사업자 미확인'}</span></div><p>{n.text}</p><div className="status-pill"><span />{PAYMENT_LABEL[result.parsed.paymentStatus]}</div></> : n.kind === 'action' ? <ol className="node-actions">{result.report.actions.map((a, i) => <li key={i}><span>{i + 1}</span><div><strong>{a.title}</strong><small>{a.urgency === 'now' ? '지금 확인' : a.urgency === 'today' ? '오늘 할 일' : '이어서 진행'}</small></div><Icon name="chevron" size={13} /></li>)}</ol> : n.kind === 'source' ? <div className="source-list">{result.rules.map(r => <div key={r.id}><span className="source-dot" /><span>{r.publisher}</span><Icon name="link" size={12} /></div>)}<small>일반 안내 · 사건별 적용 확인 필요</small></div> : <><p>{n.text}</p><div className="node-foot">{n.kind === 'question' ? <><span className="amber-dot" />{result.report.questions.length}가지 확인이 필요해요</> : <><span className="tiny-dot" />입력 자료에서 확인<Icon name="chevron" size={12} /></>}</div></>}
            </div>)}
          </div>
          <div className="canvas-hint">드래그로 이동 · 단서를 눌러 자세히 보기</div><div className="zoom-controls" onPointerDown={e => e.stopPropagation()}><button onClick={() => setZoom(z => Math.max(.3, z - .1))} aria-label="축소">−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom(z => Math.min(1.8, z + .1))} aria-label="확대">+</button><i /><button onClick={fit} aria-label="화면에 맞추기"><Icon name="fit" size={15} /></button></div>
        </div> : <div className="timeline-view"><span className="eyebrow">사건 타임라인 · 검토용</span><h2>{result.parsed.title}</h2><pre>{result.report.drafts.timeline}</pre><div className="timeline-note"><Icon name="clock" />{result.deadline.note}</div></div>}
        <div className="followup-area">{error && <p className="error" role="alert">{error}</p>}<form className="followup" onSubmit={e => { e.preventDefault(); prepare(`${history}\n\n[추가 자료 / 사용자의 새 설명]\n${followup}`); }}><Icon name="plus" /><textarea aria-label="새로운 단서 추가" value={followup} onChange={e => setFollowup(e.target.value)} maxLength={8000} placeholder="새 회신이나 더 알게 된 내용을 연결해 주세요…" rows={1} /><button className="send" disabled={busy || followup.trim().length < 5} aria-label="새 단서 연결"><Icon name="arrow" /></button></form><span>{result.mode === 'demo' ? '합성 예시입니다. 새 내용을 연결하면 OpenAI API로 분석합니다.' : '초안과 사실관계를 확인하세요. 발송·접수는 직접 진행합니다.'}</span></div>
      </section>
      {activeNode && <aside className="inspector" aria-label="단서 상세"><div className="inspector-head"><span>{activeNode.label}</span><button className="icon-button" onClick={() => setSelected(null)} aria-label="상세 닫기"><Icon name="close" /></button></div><div className="inspector-body"><h2>{activeNode.title}</h2>
        {activeNode.kind === 'fact' ? <><span className="detail-label">입력 자료</span><blockquote>{result.parsed.facts[activeNode.index!].quote}</blockquote><span className="detail-label">연결한 내용</span><p>{activeNode.text}</p><div className="detail-callout">사용자가 제공한 내용입니다. 거래의 실제 상태는 카드 앱이나 원본 자료와 대조하세요.</div></> : activeNode.kind === 'question' ? <>{result.report.questions.map((q, i) => <section key={i}><span className="detail-label">질문 0{i + 1}</span><h3>{q.question}</h3><p>{q.why}</p><button className="text-button" onClick={() => { setFollowup(`${q.question}\n답변: `); setSelected(null); }}>답변 추가하기 <Icon name="arrow" size={14} /></button></section>)}</> : activeNode.kind === 'source' ? <>{result.rules.map(r => <section key={r.id}><span className="detail-label">{r.publisher}</span><h3>{r.title}</h3><p>{r.body}</p><small>{r.scope}</small><a href={r.url} target="_blank" rel="noopener noreferrer">공식 자료 보기 ↗</a></section>)}<div className="detail-callout">{result.verification.label}<p>{result.verification.note}</p></div></> : activeNode.kind === 'action' ? <>{result.report.actions.map((a, i) => <section key={i}><span className="detail-label">행동 0{i + 1}</span><h3>{a.title}</h3><p>{a.description}</p><a href={result.rules.find(r => r.id === a.sourceId)?.url} target="_blank" rel="noopener noreferrer">연결된 안내 자료 ↗</a></section>)}<button className="solid" onClick={() => setDoc('email')}>초안 살펴보기 <Icon name="arrow" /></button></> : <><p>{result.report.explanation}</p><div className="detail-callout"><Icon name="clock" size={16} /><strong>기한 확인 필요</strong><p>{result.deadline.note}</p></div>{result.report.routes.map(r => <section key={r.name}><span className="detail-label">대응 경로</span><h3>{r.title}</h3><p>{r.note}</p>{r.missing.map(m => <div className="missing" key={m}><span />{m}</div>)}</section>)}</>}
      </div></aside>}
    </main>}

    <input type="file" accept=".txt,text/plain" hidden ref={upload} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 80000) setError('80KB 이하 텍스트 파일을 추가해 주세요.'); else { const t = await f.text(); if (input.length + t.length > 20000) setError('전체 입력이 20,000자를 넘습니다.'); else setInput(v => v + (v ? '\n\n' : '') + t); } e.target.value = ''; }} />
    {busy && <div className="loading-overlay" role="status"><div className="loading-card"><div className="orbit"><span /><span /><span /><i /></div><span className="eyebrow">CONNECTING THE CLUES</span><h2>사건의 연결 고리를 찾고 있어요</h2><p>{progress}</p><div className="stage-list">{STAGES.map((s, i) => <span key={s} className={i <= stage ? 'current' : ''}>{i < stage ? <Icon name="check" size={13} /> : <i />}{s}</span>)}</div><button className="text-button" onClick={() => { abort.current?.abort(); setBusy(false); }}>분석 취소</button></div></div>}
    <dialog ref={reviewRef} className="modal review-modal" onCancel={() => setReview(null)}><div className="modal-head"><div><span className="eyebrow">BEFORE WE CONNECT</span><h2>보낼 내용을 확인해 주세요</h2></div><button className="icon-button" onClick={() => setReview(null)} aria-label="전송 확인 닫기"><Icon name="close" /></button></div><p>일부 번호와 이메일을 숨겼어요. 이름·주소 등 남은 개인정보는 직접 지워 주세요. 아래 텍스트가 OpenAI API로 전송됩니다.</p><textarea aria-label="전송할 내용 확인" value={review || ''} onChange={e => setReview(e.target.value)} maxLength={20000} /><div className="modal-foot"><span>자동 마스킹은 완전한 익명화를 보장하지 않습니다.</span><button className="solid" disabled={!review || review.trim().length < 20} onClick={() => review && analyze(maskText(review))}>이 내용으로 분석 <Icon name="arrow" /></button></div></dialog>
    <dialog ref={dialogRef} className="modal docs-modal" onCancel={() => setDoc(null)}><div className="modal-head"><div><span className="eyebrow">READY FOR YOUR REVIEW</span><h2>내 사건의 제출 초안</h2></div><button className="icon-button" onClick={() => setDoc(null)} aria-label="초안 닫기"><Icon name="close" /></button></div><div className="doc-tabs" role="tablist">{(['email', 'statement', 'timeline'] as const).map(t => <button role="tab" aria-selected={doc === t} key={t} onClick={() => setDoc(t)}>{t === 'email' ? '영문 문의 메일' : t === 'statement' ? '국문 사실 정리' : '타임라인'}</button>)}</div><pre>{result && doc ? result.report.drafts[doc] : ''}</pre><div className="modal-foot"><span>사실관계와 빈칸을 검토한 뒤 직접 보내세요.</span><button className="solid" onClick={async () => { try { if (result && doc) await navigator.clipboard.writeText(result.report.drafts[doc]); setCopied(true); } catch { setToast('복사 권한이 없습니다. 초안을 선택해 복사해 주세요.'); } }}><Icon name={copied ? 'check' : 'file'} size={15} />{copied ? '복사했어요' : '초안 복사'}</button></div></dialog>
    {toast && <div className="toast" role="status">{toast}</div>}
    {result && saved && <button className="delete-saved" onClick={() => { localStorage.removeItem(STORE); setSaved(false); setToast('이 브라우저에 저장한 사건을 삭제했어요.'); }}>저장본 삭제</button>}
  </>;
}

