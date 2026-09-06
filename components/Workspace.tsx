'use client';

import { CASE_LABEL, PAYMENT_LABEL, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, Phase, ReasonMapping } from '@/lib/playbook';
import { Icon } from './Icon';
import { Diagnose } from './Diagnose';
import { Plan } from './Plan';
import { Package } from './Package';
import { Board } from './Board';

export type Stage = 'diagnose' | 'plan' | 'package' | 'board';

const STAGES: { id: Stage; title: string; caption: string }[] = [
  { id: 'diagnose', title: '진단', caption: '신호 · 가맹점 · 사실' },
  { id: 'plan', title: '72시간 계획', caption: '지혈 · 가맹점 · 카드사' },
  { id: 'package', title: '이의신청 패키지', caption: '사유코드 · 증빙 · 초안' },
  { id: 'board', title: '연결 보드', caption: '단서를 한눈에' },
];

type Props = {
  result: CaseResult;
  revision: number;
  previous: CaseResult | null;
  onDismissPrevious: () => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  merchant: Merchant | null;
  plan: Phase[];
  mapping: ReasonMapping | null;
  evidence: EvidenceItem[];
  checks: Record<string, boolean>;
  toggle: (id: string) => void;
  txDate: string;
  setTxDate: (v: string) => void;
  deadlineRef: { due: string; daysLeft: number } | null;
  readiness: { done: number; total: number; pct: number };
  form: { label: string; value: string }[];
  followup: string;
  setFollowup: (v: string) => void;
  onFollowup: () => void;
  busy: boolean;
  error: string;
  onAnswer: (question: string) => void;
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
};

function stampDate() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}`;
}

export function Workspace(p: Props) {
  const { result, stage, setStage, merchant, deadlineRef } = p;
  const { parsed } = result;
  const planDone = p.plan.reduce((n, ph) => n + ph.steps.filter(s => p.checks[`${ph.id}:${s.id}`]).length, 0);
  const planTotal = p.plan.reduce((n, ph) => n + ph.steps.length, 0);
  const progress: Record<Stage, string> = {
    diagnose: `${parsed.signals.length} 신호 · ${parsed.facts.length} 사실`,
    plan: `${planDone}/${planTotal} 완료`,
    package: `증빙 ${p.readiness.pct}%`,
    board: '',
  };
  const dday = deadlineRef ? (deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`) : '기준일 확인';

  return (
    <div className="page">
      <section className="ticket is-ready" key={`${parsed.title}-${p.revision}`} aria-label="사건 요약">
        <div className="ticket__main">
          <div className="nameplate">
            <p className="nameplate__class">{CASE_LABEL[parsed.caseType]} · 사건 v{p.revision}</p>
            <h1 className="nameplate__line">{parsed.title}</h1>
            <p className="nameplate__sub">{parsed.summary}</p>
          </div>
          <div className={`stamp ${result.mode === 'demo' ? 'demo' : ''}`} aria-hidden="true">
            <div className="stamp__inner"><span className="stamp__top">{result.mode === 'demo' ? '합성 예시' : '분석 완료'}</span><span className="stamp__date">{stampDate()}</span><span className="stamp__bottom">분쟁72</span></div>
          </div>
          <dl className="details">
            <div className="details__cell"><dt>가맹점</dt><dd>{merchant ? merchant.name : parsed.merchant || '미확인'}{parsed.descriptor && <code>{parsed.descriptor}</code>}</dd></div>
            <div className="details__cell"><dt>금액</dt><dd><span className="mono">{parsed.amount || '확인 필요'}</span></dd></div>
            <div className="details__cell"><dt>거래 상태</dt><dd><span className={`pill status-${parsed.paymentStatus}`}>{PAYMENT_LABEL[parsed.paymentStatus]}</span></dd></div>
            <div className="details__cell"><dt>참고 기한</dt><dd className={deadlineRef && deadlineRef.daysLeft <= 30 ? 'urgent' : ''}><span className="mono">{dday}</span>{deadlineRef && <code>{deadlineRef.due} 까지</code>}</dd></div>
          </dl>
        </div>
      </section>

      {p.previous && (
        <div className="change-banner">
          <Icon name="link" size={14} />
          <span>새 단서로 갱신했어요 · {p.previous.parsed.paymentStatus !== parsed.paymentStatus ? `${PAYMENT_LABEL[p.previous.parsed.paymentStatus]} → ${PAYMENT_LABEL[parsed.paymentStatus]}` : `확인된 단서 ${p.previous.parsed.facts.length}개 → ${parsed.facts.length}개`}</span>
          <button className="iconbtn" onClick={p.onDismissPrevious} aria-label="갱신 알림 닫기"><Icon name="close" size={13} /></button>
        </div>
      )}

      <nav className="stagenav" aria-label="단계">
        {STAGES.map((s, i) => (
          <button key={s.id} className={stage === s.id ? 'active' : ''} onClick={() => setStage(s.id)} aria-current={stage === s.id ? 'step' : undefined}>
            <span className="n">0{i + 1}</span>
            <span className="t">{s.title}</span>
            <span className="s">{progress[s.id] || s.caption}</span>
          </button>
        ))}
      </nav>

      <div className="stage-body">
        {stage === 'diagnose' && <Diagnose result={result} merchant={merchant} onAnswer={p.onAnswer} />}
        {stage === 'plan' && <Plan result={result} plan={p.plan} checks={p.checks} toggle={p.toggle} txDate={p.txDate} setTxDate={p.setTxDate} deadlineRef={deadlineRef} onGoPackage={() => setStage('package')} />}
        {stage === 'package' && <Package result={result} merchant={merchant} mapping={p.mapping} evidence={p.evidence} checks={p.checks} toggle={p.toggle} readiness={p.readiness} form={p.form} deadlineRef={deadlineRef} onCopy={p.onCopy} onExport={p.onExport} />}
        {stage === 'board' && <Board result={result} onAnswer={p.onAnswer} />}
      </div>

      <div className="followup-area">
        {p.error && <p className="error" role="alert">{p.error}</p>}
        <form className="followup" onSubmit={e => { e.preventDefault(); p.onFollowup(); }}>
          <Icon name="plus" size={16} />
          <textarea aria-label="새로운 단서 추가" value={p.followup} onChange={e => p.setFollowup(e.target.value)} maxLength={8000} placeholder="가맹점 회신, 매입 확인, 새로 알게 된 내용을 붙여넣으면 다시 분석합니다" rows={1} />
          <button className="inkbtn" disabled={p.busy || p.followup.trim().length < 5}>연결 <Icon name="arrow" size={14} /></button>
        </form>
        <span>{result.mode === 'demo' ? '합성 예시 · 새 내용을 연결하면 OpenAI API로 분석합니다' : '검토용 결과 · 발송과 접수는 직접 진행합니다'}</span>
      </div>
    </div>
  );
}
