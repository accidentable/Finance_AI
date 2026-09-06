'use client';

import { SIGNAL_HINT, SIGNAL_LABEL, type CaseResult } from '@/lib/case';
import { sellerFromDescriptor, type Merchant } from '@/lib/playbook';
import { VERIFIED_LABEL } from '@/lib/knowledge';
import { Icon } from './Icon';

type Props = { result: CaseResult; merchant: Merchant | null; onAnswer: (question: string) => void };

export function Diagnose({ result, merchant, onAnswer }: Props) {
  const { parsed, report, verification } = result;
  const seller = sellerFromDescriptor(parsed.descriptor);
  const accessed = merchant?.sources[0]?.accessed;
  return (
    <div className="stage">
      <section className="sheet hero">
        <div className="sheet__h"><Icon name="sparkle" size={14} /> {result.mode === 'demo' ? '예시의 판단 요약' : 'AI가 정리한 판단'}</div>
        <h2>{report.headline}</h2>
        <p>{report.explanation}</p>
        {report.basis.length > 0 && (
          <ol className="basis">
            {report.basis.map((b, i) => {
              const ref = result.references.find(r => r.id === b.refId);
              return (
                <li key={i}>
                  <span className="basis__n">{i + 1}</span>
                  <div>
                    <p>{b.point}</p>
                    {ref && <a className="ref-chip" href={ref.url} target="_blank" rel="noopener noreferrer"><span className={`ref-kind ${ref.kind}`}>{ref.kind === 'code' ? '사유코드' : ref.kind === 'issuer' ? '카드사' : ref.kind === 'merchant' ? '사업자 정책' : ref.kind === 'authority' ? '당국 안내' : '참고 자료'}</span>{ref.title}<Icon name="external" size={10} /></a>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <p className="fine">근거는 모아 둔 규정·정책에서만 골라요. 거기 없는 코드나 기한은 쓰지 않도록 막아 뒀어요. 조회일 {result.references[0]?.accessed ?? ''}.</p>
      </section>

      <div className="grid-2">
        <section className="sheet">
          <div className="sheet__h"><Icon name="radar" size={14} /> 탐지된 이상 신호 <span className="count">{parsed.signals.length}</span></div>
          {parsed.signals.length === 0 ? (
            <p className="empty">원문에서 뚜렷한 이상 신호를 찾지 못했어요. 아래 사실과 질문으로 상황을 좁혀 보세요.</p>
          ) : (
            <ul className="signals">
              {parsed.signals.map(s => (
                <li key={s.kind}>
                  <span className="leg__node" aria-hidden="true" />
                  <div>
                    <b>{SIGNAL_LABEL[s.kind]}</b>
                    <p>{SIGNAL_HINT[s.kind]}</p>
                    <blockquote className="leg__quote">“{s.evidence}”</blockquote>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sheet">
          <div className="sheet__head">
            <div className="sheet__h"><Icon name="globe" size={14} /> 가맹점 표기 해독</div>
            {merchant && <span className={`verify-badge ${merchant.verified}`}>{VERIFIED_LABEL[merchant.verified]}</span>}
          </div>
          <div className="decode">
            <code>{parsed.descriptor || '표기 없음'}</code>
            <Icon name="arrow" size={14} />
            <div>
              <b>{merchant ? merchant.name : parsed.merchant || '가맹점 미확인'}</b>
              <small>{merchant ? merchant.category : '정책 사전에 없는 가맹점이에요'}</small>
            </div>
          </div>
          {merchant?.processor && <p className="seller-line">실제 판매자: <b>{seller || parsed.merchant || '표기에서 확인 필요'}</b></p>}
          {merchant ? (
            <>
              <dl className="policy">
                <div><dt>환불 조건</dt><dd>{merchant.refund}</dd></div>
                <div><dt>해지 규칙</dt><dd>{merchant.cancellation}</dd></div>
                <div><dt>미승인·오청구 창구</dt><dd>{merchant.unauthorized}</dd></div>
                {merchant.processingTime && !/미기재|해당 없음/.test(merchant.processingTime) && <div><dt>환불 처리 기간</dt><dd>{merchant.processingTime}</dd></div>}
              </dl>
              {merchant.usageBased && <p className="fine">사용량만큼 내는 서비스예요. 사용 기록은 사업자가 갖고 있으니, 내가 평소 얼마나 썼는지와 언제부터 이상했는지가 핵심 증빙이에요.</p>}
              {merchant.notes.length > 0 && (
                <ul className="guide-notes">
                  {merchant.notes.map(n => <li key={n}><Icon name="alert" size={12} />{n}</li>)}
                </ul>
              )}
              <div className="links">
                {merchant.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} <Icon name="external" size={11} /></a>)}
              </div>
              <p className="sources">출처{accessed ? ` · 조회 ${accessed}` : ''}: {merchant.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
            </>
          ) : (
            <p>정책 사전에 없는 표기예요. 영수증 메일의 보낸 도메인과 계정 화면의 고객지원 메뉴에서 공식 창구를 찾아 주세요. STRIPE *나 PADDLE.NET* 같은 결제대행 표기라면 별표 뒤가 실제 판매자예요.</p>
          )}
          <div className={`verify ${verification.label === '도메인 목록 일치' ? 'ok' : ''}`}>
            <Icon name="shield" size={15} />
            <div><b>{verification.label}</b>{verification.domain && <code>{verification.domain}</code>}<p>{verification.note}</p></div>
          </div>
        </section>
      </div>

      <section className="sheet">
        <div className="sheet__h"><Icon name="list" size={14} /> 확인한 사실 <span className="count">{parsed.facts.length}</span></div>
        <ol className="facts">
          {parsed.facts.map((f, i) => (
            <li key={i}>
              <span className="k">{f.label}</span>
              <div>
                <b>{f.value}</b>
                <blockquote className="leg__quote">{f.quote}</blockquote>
              </div>
            </li>
          ))}
        </ol>
        <p className="fine">원문에 그대로 있는 내용만 사실로 남겼어요. 원문에 없는 말은 자동으로 뺐어요.</p>
        {result.transcript && (
          <details className="transcript">
            <summary><Icon name="file" size={13} /> 첨부 사진에서 읽은 내용 <span className="count">{result.transcript.split('\n').filter(Boolean).length}줄</span></summary>
            <pre>{result.transcript}</pre>
            <p className="fine">AI가 사진 속 글자를 옮겨 적고 번호·이메일·키 모양을 가린 결과예요. 원본과 다르면 아래 입력창에 바로잡아서 다시 연결해 주세요.</p>
          </details>
        )}
      </section>

      <section className="sheet">
        <div className="sheet__h"><Icon name="search" size={14} /> 확인할 질문 <span className="count">{report.questions.length}</span></div>
        {report.questions.length === 0 ? <p className="empty">더 물어볼 게 없어요. 사실관계만 한 번 더 봐 주세요.</p> : (
          <ul className="questions">
            {report.questions.map((q, i) => (
              <li key={i}>
                <div><b>{q.question}</b><p>{q.why}</p></div>
                <button className="textlink" onClick={() => onAnswer(q.question)}>답변 추가 →</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
