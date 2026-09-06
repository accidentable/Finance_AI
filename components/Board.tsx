'use client';

import { useEffect, useRef, useState } from 'react';
import { PAYMENT_LABEL, type CaseResult } from '@/lib/case';
import { Icon } from './Icon';

type Position = { x: number; y: number };
type Node = { id: string; kind: 'fact' | 'case' | 'question' | 'action' | 'source'; title: string; label: string; text: string; index?: number; width: number; height: number; pos: Position };

export function Board({ result, onAnswer }: { result: CaseResult; onAnswer: (question: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Position>({ x: 0, y: 0 });
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const drag = useRef<{ id: string; x: number; y: number; origin: Position } | null>(null);

  function fit() {
    if (!viewport.current) return;
    const { width, height } = viewport.current.getBoundingClientRect();
    const extra = Math.floor(Math.max(0, (result.parsed.facts.length || 1) - 1) / 3) * 300;
    const z = Math.max(0.3, Math.min((width - 60) / (1240 + extra), (height - 40) / 620, 1.15));
    setZoom(z);
    setPan({ x: (width - (1240 + extra) * z) / 2 + extra * z, y: Math.max(12, (height - 620 * z) / 2) });
  }
  useEffect(() => {
    if (!viewport.current) return;
    const ro = new ResizeObserver(fit);
    ro.observe(viewport.current);
    fit();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  useEffect(() => { setPositions({}); setSelected(null); }, [result]);

  const nodes: Node[] = [
    ...result.parsed.facts.map((f, i) => ({ id: `fact-${i}`, kind: 'fact' as const, title: f.label, label: `단서 ${String(i + 1).padStart(2, '0')}`, text: f.value, index: i, width: 270, height: 146, pos: { x: 30 + Math.floor(i / 3) * -300, y: 60 + (i % 3) * 160 } })),
    { id: 'case', kind: 'case', title: result.parsed.title, label: '사건의 중심', text: result.parsed.summary, width: 338, height: 240, pos: { x: 430, y: 140 } },
    { id: 'question', kind: 'question', title: '아직 연결되지 않은 단서', label: '추가 확인', text: result.report.questions[0]?.question || '추가 질문이 없습니다. 사실관계를 검토해 주세요.', width: 338, height: 142, pos: { x: 430, y: 418 } },
    { id: 'action', kind: 'action', title: '이 사건에 맞는 행동', label: 'AI 제안', text: '', width: 300, height: 290, pos: { x: 900, y: 60 } },
    { id: 'source', kind: 'source', title: '판단을 뒷받침하는 자료', label: '연결된 근거', text: '', width: 300, height: 185, pos: { x: 900, y: 380 } },
  ];
  const pos = (n: Node) => positions[n.id] || n.pos;
  const activeNode = nodes.find(n => n.id === selected);
  const edges = nodes.filter(n => n.id !== 'case').map(n => ({ from: n.id === 'source' ? 'action' : 'case', to: n.id, label: n.kind === 'fact' ? '확인한 사실' : n.kind === 'question' ? '더 필요한 정보' : n.kind === 'source' ? '참고 근거' : '이어지는 행동' }));

  function pointerDown(e: React.PointerEvent, id: string, origin: Position) {
    moved.current = false;
    if (e.button !== 0 || window.innerWidth <= 640) return;
    drag.current = { id, x: e.clientX, y: e.clientY, origin };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }
  function pointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
    if (d.id === 'canvas') setPan({ x: d.origin.x + dx, y: d.origin.y + dy });
    else setPositions(p => ({ ...p, [d.id]: { x: d.origin.x + dx / zoom, y: d.origin.y + dy / zoom } }));
  }

  return (
    <div className="board-wrap">
      <div ref={viewport} className="board-viewport" onPointerDown={e => pointerDown(e, 'canvas', pan)} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="canvas" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <div className="zone-label" style={{ left: 30, top: 12 }}>01 <span>수집한 단서</span></div>
          <div className="zone-label" style={{ left: 430, top: 12 }}>02 <span>사건 연결하기</span></div>
          <div className="zone-label" style={{ left: 900, top: 12 }}>03 <span>다음 단계</span></div>
          <svg className="connections" width="1240" height="760" aria-hidden="true">
            {edges.map(edge => {
              const a = nodes.find(n => n.id === edge.from)!;
              const b = nodes.find(n => n.id === edge.to)!;
              const pa = pos(a), pb = pos(b);
              const vertical = b.id === 'question' || b.id === 'source';
              const x1 = pa.x + (vertical ? a.width / 2 : pb.x < pa.x ? 0 : a.width), y1 = pa.y + (vertical ? a.height : a.height / 2);
              const x2 = pb.x + (vertical ? b.width / 2 : pb.x < pa.x ? b.width : 0), y2 = pb.y + (vertical ? 0 : b.height / 2);
              const path = vertical ? `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}` : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
              return (
                <g key={edge.to} className={`${selected && selected !== edge.from && selected !== edge.to ? 'dim' : ''} ${selected === edge.to || selected === edge.from ? 'connected' : ''}`}>
                  <path d={path} className={b.kind === 'question' ? 'dashed' : ''} />
                  <circle cx={x1} cy={y1} r="3" /><circle cx={x2} cy={y2} r="3" />
                  {b.kind !== 'fact' && <text x={(x1 + x2) / 2 + (vertical ? 12 : -18)} y={(y1 + y2) / 2 - (vertical ? 0 : 10)}>{edge.label}</text>}
                </g>
              );
            })}
          </svg>
          {nodes.map(n => (
            <div key={n.id} className={`board-node ${n.kind} ${selected === n.id ? 'selected' : ''}`} style={{ left: pos(n).x, top: pos(n).y, width: n.width, minHeight: n.height }} role="button" tabIndex={0} aria-label={`${n.label}: ${n.title}`}
              onPointerDown={e => pointerDown(e, n.id, pos(n))} onPointerUp={e => { e.stopPropagation(); drag.current = null; }}
              onClick={() => { if (!moved.current) setSelected(n.id === selected ? null : n.id); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(n.id); } }}>
              <div className="node-top"><span className="node-icon"><Icon name={n.kind === 'fact' ? (n.index === 0 ? 'mail' : 'file') : n.kind === 'case' ? 'link' : n.kind === 'question' ? 'search' : n.kind === 'action' ? 'check' : 'shield'} size={15} /></span><span>{n.label}</span></div>
              <h2>{n.title}</h2>
              {n.kind === 'case' ? (
                <><div className="case-amount">{result.parsed.amount || '금액 확인 필요'}<span>{result.parsed.merchant || '사업자 미확인'}</span></div><p>{n.text}</p><div className="status-pill"><span />{PAYMENT_LABEL[result.parsed.paymentStatus]}</div></>
              ) : n.kind === 'action' ? (
                <ol className="node-actions">{result.report.actions.map((a, i) => <li key={i}><span>{i + 1}</span><div><strong>{a.title}</strong><small>{a.urgency === 'now' ? '지금 확인' : a.urgency === 'today' ? '오늘 할 일' : '이어서 진행'}</small></div><Icon name="chevron" size={13} /></li>)}</ol>
              ) : n.kind === 'source' ? (
                <div className="source-list">{result.rules.map(r => <div key={r.id}><span className="source-dot" /><span>{r.publisher}</span><Icon name="link" size={12} /></div>)}<small>일반 안내 · 사건별 적용 확인 필요</small></div>
              ) : (
                <><p>{n.text}</p><div className="node-foot">{n.kind === 'question' ? <><span className="amber-dot" />{result.report.questions.length}가지 확인이 필요해요</> : <><span className="tiny-dot" />입력 자료에서 확인<Icon name="chevron" size={12} /></>}</div></>
              )}
            </div>
          ))}
        </div>
        <div className="canvas-hint">드래그로 이동 · 단서를 눌러 자세히 보기</div>
        <div className="zoom-controls" onPointerDown={e => e.stopPropagation()}>
          <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} aria-label="축소">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.8, z + 0.1))} aria-label="확대">+</button>
          <i />
          <button onClick={fit} aria-label="화면에 맞추기"><Icon name="fit" size={15} /></button>
        </div>
      </div>

      {activeNode && (
        <aside className="inspector" aria-label="단서 상세">
          <div className="inspector-head"><span>{activeNode.label}</span><button className="iconbtn" onClick={() => setSelected(null)} aria-label="상세 닫기"><Icon name="close" /></button></div>
          <div className="inspector-body">
            <h2>{activeNode.title}</h2>
            {activeNode.kind === 'fact' ? (
              <><span className="detail-label">입력 자료</span><blockquote>{result.parsed.facts[activeNode.index!].quote}</blockquote><span className="detail-label">연결한 내용</span><p>{activeNode.text}</p><div className="detail-callout">사용자가 제공한 내용입니다. 거래의 실제 상태는 카드 앱이나 원본 자료와 대조하세요.</div></>
            ) : activeNode.kind === 'question' ? (
              result.report.questions.map((q, i) => <section key={i}><span className="detail-label">질문 0{i + 1}</span><h3>{q.question}</h3><p>{q.why}</p><button className="textlink" onClick={() => { onAnswer(q.question); setSelected(null); }}>답변 추가하기 <Icon name="arrow" size={14} /></button></section>)
            ) : activeNode.kind === 'source' ? (
              <>{result.rules.map(r => <section key={r.id}><span className="detail-label">{r.publisher}</span><h3>{r.title}</h3><p>{r.body}</p><small>{r.scope}</small><a href={r.url} target="_blank" rel="noopener noreferrer">공식 자료 보기 ↗</a></section>)}<div className="detail-callout">{result.verification.label}<p>{result.verification.note}</p></div></>
            ) : activeNode.kind === 'action' ? (
              result.report.actions.map((a, i) => <section key={i}><span className="detail-label">행동 0{i + 1}</span><h3>{a.title}</h3><p>{a.description}</p><a href={result.rules.find(r => r.id === a.sourceId)?.url} target="_blank" rel="noopener noreferrer">연결된 안내 자료 ↗</a></section>)
            ) : (
              <><p>{result.report.explanation}</p><div className="detail-callout"><Icon name="clock" size={16} /><strong>기한 확인 필요</strong><p>{result.deadline.note}</p></div>{result.report.routes.map(r => <section key={r.name}><span className="detail-label">대응 경로</span><h3>{r.title}</h3><p>{r.note}</p>{r.missing.map(m => <div className="missing" key={m}><span />{m}</div>)}</section>)}</>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
