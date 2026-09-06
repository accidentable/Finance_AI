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
  const doneIn = (p: Phase) => p.steps.filter(s => checks[`${p.id}:${s.id}`]).length;
  const tone = deadlineRef ? (deadlineRef.daysLeft < 0 ? 'over' : deadlineRef.daysLeft <= 30 ? 'urgent' : '') : 'muted';
  const dday = deadlineRef ? (deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`) : '기준일 확인';

  return (
    <div className="stage">
      <section className="sheet deadline">
        <div>
          <div className="sheet__h"><Icon name="clock" size={14} /> 이번 여정</div>
          <ol className="legs">
            {plan.map((p, i) => (
              <li className={`leg ${i === 0 ? 'leg--hot' : ''}`} key={p.id}>
                <span className="leg__time">{p.window}</span>
                <span className="leg__node" aria-hidden="true" />
                <div className="leg__body">
                  <span className="leg__station">{p.title}</span>
                  <span className="leg__note">{p.goal} · {doneIn(p)}/{p.steps.length} 완료</span>
                </div>
              </li>
            ))}
            <li className={`leg ${deadlineRef && deadlineRef.daysLeft <= 30 ? 'leg--hot' : ''}`}>
              <span className="leg__time">{REFERENCE_DAYS}일</span>
              <span className="leg__node" aria-hidden="true" />
              <div className="leg__body">
                <span className="leg__station">카드사 접수 참고 기한</span>
                <div className="deadline__row">
                  <label className="date-field">
                    <span>{noPosting ? '매입일 (아직 없음)' : '거래일'}</span>
                    <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} aria-label="거래일" />
                  </label>
                  <div className={`dday ${tone}`}>
                    <b>{dday}</b>
                    <span>{deadlineRef ? `${deadlineRef.due} 까지 · 거래일 + ${REFERENCE_DAYS}일` : noPosting ? '매입이 생기면 그 날짜를 입력하세요' : '거래일을 입력하면 계산합니다'}</span>
                  </div>
                </div>
              </div>
            </li>
          </ol>
          <p className="fine">{noPosting ? `${result.deadline.note} ` : ''}이 날짜는 국제브랜드 규정의 통상 {REFERENCE_DAYS}일을 거래일에 더한 참고치입니다. 사유별 기준일과 카드사 접수 요건이 달라 실제 기한은 카드사에서 확인해야 합니다.</p>
        </div>
        <div className="deadline__side">
          <div className="sheet__h"><Icon name="check" size={14} /> 진행</div>
          <b>{done}<small>/{total}</small></b>
          <div className="meter"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
          <small>완료한 단계는 저장 버튼으로 이 브라우저에 보관됩니다.</small>
        </div>
      </section>

      <div className="phases">
        {plan.map(phase => (
          <section className="sheet phase" key={phase.id}>
            <header>
              <span className="phase__window">{phase.window}</span>
              <h3>{phase.title}</h3>
              <p>{phase.goal}</p>
            </header>
            <ul className="checks">
              {phase.steps.map(step => {
                const id = `${phase.id}:${step.id}`;
                return (
                  <li key={id} className={checks[id] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="box" aria-hidden="true"><Icon name="check" size={11} /></span>
                      <div>
                        <b>{step.title}{step.source === 'ai' && <span className="tag">AI 제안</span>}</b>
                        <p>{step.detail}</p>
                        {step.link && <a href={step.link.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{step.link.label} <Icon name="external" size={10} /></a>}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {phase.id === 'issuer' && <button className="ghostbtn phase__cta" onClick={onGoPackage}>이의신청 패키지 열기 →</button>}
          </section>
        ))}
      </div>

      <section className="sheet">
        <div className="sheet__h"><Icon name="building" size={14} /> 경로별 준비 상태</div>
        <div className="routes">
          {result.report.routes.map(r => (
            <div className="route" key={r.name}>
              <span className="label">{r.name === 'merchant' ? '가맹점' : r.name === 'issuer' ? '카드사' : '소비자원'}</span>
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
