'use client';

import { SIGNAL_HINT, SIGNAL_LABEL, type CaseResult } from '@/lib/case';
import { sellerFromDescriptor, type Merchant } from '@/lib/playbook';
import { Icon } from './Icon';

type Props = { result: CaseResult; merchant: Merchant | null; onAnswer: (question: string) => void };

export function Diagnose({ result, merchant, onAnswer }: Props) {
  const { parsed, report, verification } = result;
  const seller = sellerFromDescriptor(parsed.descriptor);
  return (
    <div className="stage">
      <section className="card hero">
        <span className="eyebrow">{result.mode === 'demo' ? '합성 예시의 판단 요약' : 'AI 판단 요약'}</span>
        <h2>{report.headline}</h2>
        <p>{report.explanation}</p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h3><Icon name="radar" size={17} /> 탐지된 이상 신호 <span className="count">{parsed.signals.length}</span></h3>
          {parsed.signals.length === 0 ? (
            <p className="empty">원문에서 뚜렷한 이상 신호를 찾지 못했습니다. 아래 사실과 질문으로 상황을 좁혀 보세요.</p>
          ) : (
            <ul className="signals">
              {parsed.signals.map(s => (
                <li key={s.kind}>
                  <div className="signal-head"><span className="signal-dot" /><b>{SIGNAL_LABEL[s.kind]}</b></div>
                  <p>{SIGNAL_HINT[s.kind]}</p>
                  <blockquote>“{s.evidence}”</blockquote>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3><Icon name="globe" size={17} /> 가맹점 해독</h3>
          <div className="descriptor-row">
            <code>{parsed.descriptor || '표기 없음'}</code>
            <Icon name="arrow" size={14} />
            <div>
              <b>{merchant ? merchant.name : parsed.merchant || '가맹점 미확인'}</b>
              <small>{merchant ? merchant.category : '사전에 없는 가맹점'}</small>
            </div>
          </div>
          {merchant?.processor && <p className="seller">실제 판매자: <b>{seller || parsed.merchant || '표기에서 확인 필요'}</b></p>}
          {merchant ? (
            <>
              <p>{merchant.note}</p>
              {merchant.usageBased && <p className="fine">사용량 기반 과금입니다. 사용 기록은 사업자가 보유하므로 본인 사용량 기준과 시점을 정리해 두는 것이 핵심 증빙입니다.</p>}
              <div className="links">
                {merchant.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} <Icon name="external" size={12} /></a>)}
              </div>
            </>
          ) : (
            <p>사전에 등록된 표기가 아닙니다. 영수증 메일의 발신 도메인과 계정 화면의 지원 메뉴에서 공식 창구를 확인하세요. 결제대행 표기(STRIPE *, PADDLE.NET*)라면 별표 뒤가 실제 판매자입니다.</p>
          )}
          <div className={`verify ${verification.label === '도메인 목록 일치' ? 'ok' : ''}`}>
            <Icon name="shield" size={15} />
            <div><b>{verification.label}</b>{verification.domain && <code>{verification.domain}</code>}<p>{verification.note}</p></div>
          </div>
        </section>
      </div>

      <section className="card">
        <h3><Icon name="list" size={17} /> 확인한 사실 <span className="count">{parsed.facts.length}</span></h3>
        <ol className="facts">
          {parsed.facts.map((f, i) => (
            <li key={i}>
              <div className="fact-head"><span className="fact-label">{f.label}</span><b>{f.value}</b></div>
              <blockquote>{f.quote}</blockquote>
            </li>
          ))}
        </ol>
        <p className="fine">모든 사실은 입력 원문에서 그대로 인용한 부분만 남겼습니다. 원문에 없는 내용은 자동으로 제외됩니다.</p>
      </section>

      <section className="card">
        <h3><Icon name="search" size={17} /> 확인할 질문 <span className="count">{report.questions.length}</span></h3>
        {report.questions.length === 0 ? <p className="empty">추가 질문이 없습니다. 사실관계를 검토해 주세요.</p> : (
          <ul className="questions">
            {report.questions.map((q, i) => (
              <li key={i}>
                <div><b>{q.question}</b><p>{q.why}</p></div>
                <button className="text-button" onClick={() => onAnswer(q.question)}>답변 추가 <Icon name="arrow" size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
