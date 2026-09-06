'use client';

import type { CaseResult } from '@/lib/case';
import { REFERENCE_DAYS, type Phase } from '@/lib/playbook';
import { Icon } from './Icon';

type Props = {
  result: CaseResult;
  plan: Phase[];
  checks: Record<string, boolean>;
  toggle: (id: string) => void;
  txDate: string;
  setTxDate: (v: string) => void;
  deadlineRef: { due: string; daysLeft: number } | null;
  onGoPackage: () => void;
};

export function Plan({ result, plan, checks, toggle, txDate, setTxDate, deadlineRef, onGoPackage }: Props) {
  const noPosting = result.parsed.paymentStatus === 'declined' || result.parsed.paymentStatus === 'invoice_only';
  const total = plan.reduce((n, p) => n + p.steps.length, 0);
  const done = plan.reduce((n, p) => n + p.steps.filter(s => checks[`${p.id}:${s.id}`]).length, 0);
  const tone = deadlineRef ? (deadlineRef.daysLeft < 0 ? 'over' : deadlineRef.daysLeft <= 30 ? 'urgent' : '') : '';
  return (
    <div className="stage">
      <section className="card deadline">
        <div className="deadline-main">
          <span className="eyebrow">참고 기한</span>
          <div className="deadline-row">
            <label className="date-field">
              <span>{noPosting ? '매입일 (아직 없음)' : '거래일'}</span>
              <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} aria-label="거래일" />
            </label>
            {deadlineRef ? (
              <div className={`dday ${tone}`}>
                <b>{deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`}</b>
                <span>{deadlineRef.due}까지 · 거래일 + {REFERENCE_DAYS}일</span>
              </div>
            ) : (
              <div className="dday muted"><b>기준일 확인</b><span>{noPosting ? '매입이 생기면 그 날짜를 입력하세요' : '거래일을 입력하면 참고 기한을 계산합니다'}</span></div>
            )}
          </div>
          <p className="fine">{noPosting ? `${result.deadline.note} ` : ''}이 날짜는 국제브랜드 규정의 통상 {REFERENCE_DAYS}일을 거래일에 더한 참고치입니다. 사유별 기준일과 카드사 접수 요건이 달라 실제 기한은 카드사에서 확인해야 합니다.</p>
        </div>
        <div className="deadline-side">
          <span className="eyebrow">진행</span>
          <b>{done}<small>/{total}</small></b>
          <div className="meter"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <small>완료한 단계는 이 브라우저에 저장할 수 있어요</small>
        </div>
      </section>

      <div className="phases">
        {plan.map((phase, pi) => (
          <section className={`card phase phase-${phase.id}`} key={phase.id}>
            <header>
              <span className="window">{phase.window}</span>
              <h3><span className="phase-num">{pi + 1}</span>{phase.title}</h3>
              <p>{phase.goal}</p>
            </header>
            <ul className="steps">
              {phase.steps.map(step => {
                const id = `${phase.id}:${step.id}`;
                return (
                  <li key={id} className={checks[id] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="checkbox" aria-hidden="true"><Icon name="check" size={12} /></span>
                      <div>
                        <b>{step.title}{step.source === 'ai' && <span className="tag ai">AI 제안</span>}</b>
                        <p>{step.detail}</p>
                        {step.link && <a href={step.link.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{step.link.label} <Icon name="external" size={11} /></a>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {phase.id === 'issuer' && <button className="outline phase-cta" onClick={onGoPackage}>이의신청 패키지 열기 <Icon name="arrow" size={14} /></button>}
          </section>
        ))}
      </div>

      <section className="card">
        <h3><Icon name="building" size={17} /> 경로별 준비 상태</h3>
        <div className="routes">
          {result.report.routes.map(r => (
            <div className="route" key={r.name}>
              <span className="eyebrow">{r.name === 'merchant' ? '가맹점' : r.name === 'issuer' ? '카드사' : '소비자원'}</span>
              <b>{r.title}</b>
              <p>{r.note}</p>
              {r.missing.length > 0 && <div className="chips">{r.missing.map(m => <span key={m}>{m}</span>)}</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
