'use client';

import { SIGNAL_LABEL, type CaseResult } from '@/lib/case';
import { sellerFromDescriptor, type Merchant } from '@/lib/playbook';
import { VERIFIED_LABEL } from '@/lib/knowledge';
import { Icon } from './Icon';

type Props = { result: CaseResult; merchant: Merchant | null };

const KIND_LABEL: Record<string, string> = { code: '카드 규정', issuer: '카드사 안내', merchant: '사업자 정책', authority: '공공기관 안내', rule: '참고 자료' };

// 접혀 있는 "왜 이렇게 판단했나요" 영역. 급한 사용자는 열지 않아도 되고, 확인하고 싶을 때만 연다.
export function Reasoning({ result, merchant }: Props) {
  const { parsed, report, verification } = result;
  const seller = sellerFromDescriptor(parsed.descriptor);
  return (
    <details className="sheet fold" id="why">
      <summary>
        <span className="fold__title"><Icon name="search" size={18} /> 왜 이렇게 판단했나요</span>
        <span className="fold__meta">근거 {report.basis.length} · 신호 {parsed.signals.length} · 확인한 사실 {parsed.facts.length}</span>
      </summary>
      <div className="fold__body">
        {report.basis.length > 0 && (
          <div className="fold__block">
            <p className="label label--strong">근거가 된 규정과 정책</p>
            <ol className="basis">
              {report.basis.map((b, i) => {
                const ref = result.references.find(r => r.id === b.refId);
                return (
                  <li key={i}>
                    <span className="basis__n">{i + 1}</span>
                    <div>
                      <p>{b.point}</p>
                      {ref && <a className="ref-chip" href={ref.url} target="_blank" rel="noopener noreferrer"><span className={`ref-kind ${ref.kind}`}>{KIND_LABEL[ref.kind] ?? '참고 자료'}</span>{ref.title}<Icon name="external" size={12} /></a>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="grid-2">
          <div className="fold__block">
            <p className="label label--strong">입력에서 찾은 이상 신호</p>
            {parsed.signals.length === 0 ? <p className="empty">뚜렷한 이상 신호는 없어요.</p> : (
              <ul className="signals">
                {parsed.signals.map(s => (
                  <li key={s.kind}>
                    <span className="leg__node" aria-hidden="true" />
                    <div><b>{SIGNAL_LABEL[s.kind]}</b><blockquote className="leg__quote">“{s.evidence}”</blockquote></div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="fold__block">
            <div className="sheet__head">
              <p className="label label--strong">가맹점은 어디인가요</p>
              {merchant && <span className={`verify-badge ${merchant.verified}`}>{VERIFIED_LABEL[merchant.verified]}</span>}
            </div>
            <div className="decode">
              <code>{parsed.descriptor || '표기 없음'}</code>
              <Icon name="arrow" size={16} />
              <div><b>{merchant ? merchant.name : parsed.merchant || '가맹점 미확인'}</b><small>{merchant ? merchant.category : '정책 사전에 없어요'}</small></div>
            </div>
            {merchant?.processor && <p className="seller-line">실제 판매자: <b>{seller || parsed.merchant || '표기에서 확인 필요'}</b></p>}
            {merchant ? (
              <>
                <dl className="policy">
                  <div><dt>환불</dt><dd>{merchant.refund}</dd></div>
                  <div><dt>해지</dt><dd>{merchant.cancellation}</dd></div>
                  <div><dt>미승인 청구</dt><dd>{merchant.unauthorized}</dd></div>
                </dl>
                <div className="links">
                  {merchant.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} <Icon name="external" size={12} /></a>)}
                </div>
                <p className="sources">출처: {merchant.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
              </>
            ) : (
              <p className="empty">영수증 메일의 고객지원 링크에서 공식 창구를 찾아 주세요.</p>
            )}
            <div className={`verify ${verification.label === '도메인 목록 일치' ? 'ok' : ''}`}>
              <Icon name="shield" size={18} />
              <div><b>{verification.label}</b>{verification.domain && <code>{verification.domain}</code>}<p>{verification.note}</p></div>
            </div>
          </div>
        </div>

        <div className="fold__block">
          <p className="label label--strong">입력에서 확인한 사실</p>
          <ol className="facts">
            {parsed.facts.map((f, i) => (
              <li key={i}>
                <span className="k">{f.label}</span>
                <div><b>{f.value}</b><blockquote className="leg__quote">{f.quote}</blockquote></div>
              </li>
            ))}
          </ol>
          {result.transcript && (
            <details className="transcript">
              <summary><Icon name="camera" size={15} /> 사진에서 읽은 내용 <span className="count">{result.transcript.split('\n').filter(Boolean).length}줄</span></summary>
              <pre>{result.transcript}</pre>
            </details>
          )}
        </div>
      </div>
    </details>
  );
}
