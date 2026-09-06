'use client';

import type { CaseResult } from '@/lib/case';
import { REFERENCE_DAYS, type Phase } from '@/lib/playbook';
import type { Issuer } from '@/lib/knowledge';
import { Icon } from './Icon';

type Props = {
  result: CaseResult;
  plan: Phase[];
  checks: Record<string, boolean>;
  toggle: (id: string) => void;
  txDate: string;
  setTxDate: (v: string) => void;
  deadlineRef: { due: string; daysLeft: number } | null;
  issuer: Issuer | null;
  onCopy: (text: string, label: string) => void;
};

// 단계 이름은 사용자가 지금 어디에 있는지 바로 알 수 있게 시간 기준으로 쓴다.
const PHASE_META: Record<Phase['id'], { when: string; title: string }> = {
  stop: { when: '지금 바로 · 1시간 안에', title: '더 나가는 돈부터 막기' },
  merchant: { when: '이어서 · 12시간 안에', title: '가맹점에 환불 요청하기' },
  issuer: { when: '24시간 안에', title: '카드사 접수 준비하기' },
};

export function Steps({ result, plan, checks, toggle, txDate, setTxDate, deadlineRef, issuer, onCopy }: Props) {
  const noPosting = result.parsed.paymentStatus === 'declined' || result.parsed.paymentStatus === 'invoice_only';
  const doneIn = (p: Phase) => p.steps.filter(s => checks[`${p.id}:${s.id}`]).length;
  const total = plan.reduce((n, p) => n + p.steps.length, 0);
  const done = plan.reduce((n, p) => n + doneIn(p), 0);
  const currentIndex = Math.max(0, plan.findIndex(p => doneIn(p) < p.steps.length));
  const allDone = total > 0 && done === total;
  const issuerWeb = issuer?.channels.find(c => c.type === 'web' && c.url);
  const dday = deadlineRef ? (deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`) : null;

  return (
    <section className="sheet todo" id="todo" aria-label="지금 할 일">
      <div className="todo__head">
        <div>
          <div className="sheet__h"><Icon name="bolt" size={16} /> 지금 할 일</div>
          <h2 className="todo__title">{allDone ? '세 단계를 모두 마쳤어요' : `${currentIndex + 1}단계 · ${PHASE_META[plan[currentIndex]?.id ?? 'stop'].title}`}</h2>
          <p className="todo__sub">위에서부터 순서대로 하면 돼요. 한 항목을 끝낼 때마다 체크해 주세요.</p>
        </div>
        <div className="todo__progress"><b>{done}<small>/{total}</small></b><div className="meter"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div></div>
      </div>

      <ol className="process">
        {plan.map((phase, i) => {
          const meta = PHASE_META[phase.id];
          const finished = doneIn(phase) === phase.steps.length && phase.steps.length > 0;
          const state = finished ? 'done' : i === currentIndex && !allDone ? 'current' : i < currentIndex ? 'done' : 'later';
          return (
            <li key={phase.id} className={`process__phase is-${state}`} id={`phase-${phase.id}`}>
              <div className="process__marker"><span className="process__n">{finished ? <Icon name="check" size={16} /> : i + 1}</span></div>
              <details className="process__body" open={state === 'current'}>
                <summary>
                  <p className="process__when">{meta.when}{state === 'current' && <span className="process__now">지금 여기</span>}</p>
                  <h3>{meta.title}</h3>
                  <p className="process__goal">{phase.goal} · 할 일 {phase.steps.length}개{doneIn(phase) ? ` 중 ${doneIn(phase)}개 완료` : ''}</p>
                </summary>
                <ul className="checks">
                  {phase.steps.map(step => {
                    const id = `${phase.id}:${step.id}`;
                    return (
                      <li key={id} className={checks[id] ? 'done' : ''}>
                        <label>
                          <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                          <span className="box" aria-hidden="true"><Icon name="check" size={13} /></span>
                          <div>
                            <b>{step.title}{step.source === 'ai' && <span className="tag">이 사건 맞춤</span>}</b>
                            <p>{step.detail}</p>
                            {step.link && <a href={step.link.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{step.link.label} <Icon name="external" size={12} /></a>}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {phase.id === 'merchant' && (
                  <div className="process__actions">
                    <button className="inkbtn" onClick={() => onCopy(result.report.drafts.email, '영문 문의 메일')}><Icon name="copy" size={16} /> 보낼 영문 메일 복사</button>
                    <a className="ghostbtn" href="#documents">메일 내용 먼저 보기</a>
                  </div>
                )}
                {phase.id === 'issuer' && (
                  <>
                    <div className="deadline-line">
                      <label className="date-field">
                        <span>{noPosting ? '청구가 확정된 날' : '거래일'}</span>
                        <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} aria-label="거래일" />
                      </label>
                      <div className={`dday ${deadlineRef ? (deadlineRef.daysLeft <= 30 ? 'urgent' : '') : 'muted'}`}>
                        <b>{dday ?? '기한 계산'}</b>
                        <span>{deadlineRef ? `${deadlineRef.due}까지 접수 (거래일 + ${REFERENCE_DAYS}일, 참고치)` : noPosting ? '아직 실제 청구가 없어요. 확정되면 날짜를 넣어 주세요.' : '거래일을 넣으면 접수 기한을 계산해요.'}</span>
                      </div>
                    </div>
                    <div className="process__actions">
                      {issuerWeb ? <a className="inkbtn" href={issuerWeb.url} target="_blank" rel="noopener noreferrer">{issuer!.name} 접수 화면 열기 <Icon name="external" size={14} /></a> : null}
                      <a className="ghostbtn" href="#documents">낼 서류 보기 ↓</a>
                    </div>
                  </>
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
