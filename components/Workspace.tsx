'use client';

import { CASE_LABEL, PAYMENT_LABEL, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, Phase, ReasonMapping } from '@/lib/playbook';
import { Icon, type IconName } from './Icon';
import { Diagnose } from './Diagnose';
import { Plan } from './Plan';
import { Package } from './Package';
import { Board } from './Board';

export type Stage = 'diagnose' | 'plan' | 'package' | 'board';

const STAGES: { id: Stage; icon: IconName; title: string; caption: string }[] = [
  { id: 'diagnose', icon: 'radar', title: '진단', caption: '신호 · 가맹점 · 사실' },
  { id: 'plan', icon: 'bolt', title: '72시간 계획', caption: '지혈 · 가맹점 · 카드사' },
  { id: 'package', icon: 'scale', title: '이의신청 패키지', caption: '사유코드 · 증빙 · 초안' },
  { id: 'board', icon: 'board', title: '연결 보드', caption: '단서를 한눈에' },
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

export function Workspace(p: Props) {
  const { result, stage, setStage, merchant, deadlineRef } = p;
  const { parsed } = result;
  const planDone = p.plan.reduce((n, ph) => n + ph.steps.filter(s => p.checks[`${ph.id}:${s.id}`]).length, 0);
  const planTotal = p.plan.reduce((n, ph) => n + ph.steps.length, 0);
  const progress: Record<Stage, string> = {
    diagnose: `${parsed.signals.length}개 신호 · ${parsed.facts.length}개 사실`,
    plan: `${planDone}/${planTotal} 단계`,
    package: `증빙 ${p.readiness.pct}%`,
    board: '',
  };

  return (
    <main className="workspace">
      <nav className="stages" aria-label="단계">
        {STAGES.map((s, i) => (
          <button key={s.id} className={stage === s.id ? 'active' : ''} onClick={() => setStage(s.id)} aria-current={stage === s.id ? 'step' : undefined}>
            <span className="stage-num">{i + 1}</span>
            <span className="stage-icon"><Icon name={s.icon} size={16} /></span>
            <span className="stage-text"><b>{s.title}</b><small>{progress[s.id] || s.caption}</small></span>
          </button>
        ))}
      </nav>

      <section className="content">
        <header className="case-strip">
          <div className="strip-title">
            <span className="eyebrow">사건 <span>/ v{p.revision}</span></span>
            <h1>{parsed.title}</h1>
          </div>
          <dl className="strip-meta">
            <div><dt>가맹점</dt><dd><b>{merchant ? merchant.name : parsed.merchant || '미확인'}</b>{parsed.descriptor && <code>{parsed.descriptor}</code>}</dd></div>
            <div><dt>금액</dt><dd><b className="amount">{parsed.amount || '확인 필요'}</b></dd></div>
            <div><dt>거래 상태</dt><dd><span className={`pill status-${parsed.paymentStatus}`}>{PAYMENT_LABEL[parsed.paymentStatus]}</span></dd></div>
            <div><dt>유형</dt><dd><span className="pill">{CASE_LABEL[parsed.caseType]}</span></dd></div>
            <div><dt>참고 기한</dt><dd><b className={deadlineRef && deadlineRef.daysLeft <= 30 ? 'urgent' : ''}>{deadlineRef ? (deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`) : '기준일 확인'}</b></dd></div>
          </dl>
        </header>

        {p.previous && (
          <div className="change-banner">
            <Icon name="link" size={14} />
            <span>새 단서로 갱신했어요 · {p.previous.parsed.paymentStatus !== parsed.paymentStatus ? `${PAYMENT_LABEL[p.previous.parsed.paymentStatus]} → ${PAYMENT_LABEL[parsed.paymentStatus]}` : `확인된 단서 ${p.previous.parsed.facts.length}개 → ${parsed.facts.length}개`}</span>
            <button onClick={p.onDismissPrevious} aria-label="갱신 알림 닫기"><Icon name="close" size={13} /></button>
          </div>
        )}

        <div className={`stage-body ${stage === 'board' ? 'is-board' : ''}`}>
          {stage === 'diagnose' && <Diagnose result={result} merchant={merchant} onAnswer={p.onAnswer} />}
          {stage === 'plan' && <Plan result={result} plan={p.plan} checks={p.checks} toggle={p.toggle} txDate={p.txDate} setTxDate={p.setTxDate} deadlineRef={deadlineRef} onGoPackage={() => setStage('package')} />}
          {stage === 'package' && <Package result={result} merchant={merchant} mapping={p.mapping} evidence={p.evidence} checks={p.checks} toggle={p.toggle} readiness={p.readiness} form={p.form} onCopy={p.onCopy} onExport={p.onExport} />}
          {stage === 'board' && <Board result={result} onAnswer={p.onAnswer} />}
        </div>

        <div className="followup-area">
          {p.error && <p className="error" role="alert">{p.error}</p>}
          <form className="followup" onSubmit={e => { e.preventDefault(); p.onFollowup(); }}>
            <Icon name="plus" />
            <textarea aria-label="새로운 단서 추가" value={p.followup} onChange={e => p.setFollowup(e.target.value)} maxLength={8000} placeholder="가맹점 회신, 매입 확인, 새로 알게 된 내용을 붙여넣으면 다시 분석합니다…" rows={1} />
            <button className="send" disabled={p.busy || p.followup.trim().length < 5} aria-label="새 단서 연결"><Icon name="arrow" /></button>
          </form>
          <span>{result.mode === 'demo' ? '합성 예시입니다. 새 내용을 연결하면 OpenAI API로 분석합니다.' : '초안과 사실관계를 확인하세요. 발송·접수는 직접 진행합니다.'}</span>
        </div>
      </section>
    </main>
  );
}
