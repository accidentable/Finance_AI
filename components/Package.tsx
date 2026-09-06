'use client';

import { useState } from 'react';
import { CASE_LABEL, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, ReasonMapping } from '@/lib/playbook';
import { VERIFIED_LABEL, issuerReasonFor, type Issuer } from '@/lib/knowledge';
import { Icon } from './Icon';
import { IssuerSelect } from './IssuerSelect';

type Draft = 'email' | 'statement' | 'timeline';
const DRAFT_LABEL: Record<Draft, string> = { email: '영문 문의 메일', statement: '국문 사실 정리', timeline: '타임라인' };
const CHANNEL_LABEL: Record<string, string> = { web: '홈페이지', app: '앱', phone: '전화', branch: '영업점', fax: '팩스', mail: '우편', email: '이메일' };

type Props = {
  result: CaseResult;
  merchant: Merchant | null;
  mapping: ReasonMapping | null;
  evidence: EvidenceItem[];
  checks: Record<string, boolean>;
  toggle: (id: string) => void;
  readiness: { done: number; total: number; pct: number };
  form: { label: string; value: string }[];
  deadlineRef: { due: string; daysLeft: number } | null;
  issuer: Issuer | null;
  issuerId: string;
  setIssuerId: (id: string) => void;
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
};

function caseNumber(title: string, date: string | null) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const code = h.toString(36).toUpperCase().padStart(4, '0').slice(-4);
  const d = date ? date.slice(2).replace(/-/g, '') : '000000';
  return `D72·${d}·${code}`;
}

function IssuerGuide({ issuer, issuerId, setIssuerId, result }: { issuer: Issuer | null; issuerId: string; setIssuerId: (id: string) => void; result: CaseResult }) {
  if (!issuer) {
    return (
      <section className="sheet sheet--tint issuer-empty">
        <div className="sheet__h"><Icon name="building" size={14} /> 카드사 접수 안내</div>
        <p>카드사를 고르면 그 카드사의 접수 채널, 기한 안내, 필요한 서류, 처리 기간을 보여드려요. 아래 신청서의 사유 이름도 맞춰 드려요.</p>
        <div className="issuer-pick"><IssuerSelect value={issuerId} onChange={setIssuerId} /></div>
      </section>
    );
  }
  const reason = issuerReasonFor(issuer, result.parsed.caseType);
  const accessed = issuer.sources[0]?.accessed;
  return (
    <section className="sheet">
      <div className="sheet__head">
        <div className="sheet__h"><Icon name="building" size={14} /> {issuer.name} 해외이용 이의신청</div>
        <span className={`verify-badge ${issuer.verified}`}>{VERIFIED_LABEL[issuer.verified]}</span>
      </div>
      <dl className="details guide-details">
        <div className="details__cell"><dt>고객센터</dt><dd><span className="mono">{issuer.phone}</span></dd></div>
        <div className="details__cell"><dt>기한 안내</dt><dd className="small">{issuer.deadline}</dd></div>
        <div className="details__cell"><dt>처리 기간</dt><dd className="small">{issuer.processing}</dd></div>
        <div className="details__cell"><dt>이 사건의 사유 이름</dt><dd className="small">{reason ?? '목록에서 가장 가까운 항목을 골라 주세요'}</dd></div>
      </dl>
      <div className="grid-2 guide-grid">
        <div>
          <p className="label label--strong">접수 채널</p>
          <ul className="guide-list">
            {issuer.channels.map((c, i) => (
              <li key={i}>
                <span className="pill">{CHANNEL_LABEL[c.type] ?? c.type}</span>
                <span>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.label} <Icon name="external" size={10} /></a> : c.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {issuer.reasons.length > 0 && (
            <>
              <p className="label label--strong">카드사 사유 목록</p>
              <ul className="guide-list">
                {issuer.reasons.map(r => <li key={r} className={r === reason ? 'hit' : ''}><span className="dot" />{r}</li>)}
              </ul>
            </>
          )}
          {issuer.documents.length > 0 && (
            <>
              <p className="label label--strong">필요한 서류</p>
              <ul className="guide-list">
                {issuer.documents.map(d => <li key={d}><span className="dot" />{d}</li>)}
              </ul>
            </>
          )}
        </div>
      </div>
      {issuer.notes.length > 0 && (
        <ul className="guide-notes">
          {issuer.notes.map(n => <li key={n}><Icon name="alert" size={12} />{n}</li>)}
        </ul>
      )}
      <p className="sources">출처{accessed ? ` · 조회 ${accessed}` : ''}: {issuer.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
    </section>
  );
}

export function Package({ result, merchant, mapping, evidence, checks, toggle, readiness, form, deadlineRef, issuer, issuerId, setIssuerId, onCopy, onExport }: Props) {
  const [draft, setDraft] = useState<Draft>('email');
  const { parsed, report } = result;
  const formText = form.map(f => `${f.label}: ${f.value}`).join('\n');
  const number = caseNumber(parsed.title, parsed.transactionDate);
  return (
    <div className="stage">
      <IssuerGuide issuer={issuer} issuerId={issuerId} setIssuerId={setIssuerId} result={result} />

      <div className="grid-2">
        <section className="sheet">
          <div className="sheet__h"><Icon name="scale" size={14} /> 사유코드 후보</div>
          <p className="type-line">사건 유형 <b>{CASE_LABEL[parsed.caseType]}</b></p>
          {mapping ? (
            <>
              <div className="fare">
                <p className="fare__line"><span>Visa · {mapping.visa.name}</span><span className="mono">{mapping.visa.code}</span></p>
                <p className="fare__line"><span>Mastercard · {mapping.mastercard.name}</span><span className="mono">{mapping.mastercard.code}</span></p>
                <p className="fare__line fare__line--total"><span>가맹점 선행 접촉 기록</span><span className="mono">필수</span></p>
              </div>
              <p className="fine">{mapping.summary}</p>
              <div className="caution"><Icon name="alert" size={14} /><p>{mapping.caution}</p></div>
            </>
          ) : (
            <p className="empty">유형이 아직 정해지지 않아서 사유코드를 고르지 않았어요. 진단의 질문에 답하고 다시 분석하면 후보가 나와요.</p>
          )}
          <p className="fine">확정이 아니라 상담할 때 쓰는 후보예요. 최종 결정은 카드사가 국제브랜드 규정에 따라 해요.</p>
        </section>

        <section className="sheet">
          <div className="sheet__h"><Icon name="check" size={14} /> 증빙 준비도</div>
          <div className="readiness"><b>{readiness.pct}%</b><span>{readiness.done} / {readiness.total} 준비됐어요</span></div>
          <div className="meter big"><div style={{ width: `${readiness.pct}%` }} /></div>
          {evidence.length === 0 ? <p className="empty">유형이 정해지면 체크리스트가 생겨요.</p> : (
            <ul className="checks">
              {evidence.map(item => {
                const id = `ev:${item.id}`;
                return (
                  <li key={id} className={checks[id] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="box" aria-hidden="true"><Icon name="check" size={11} /></span>
                      <div><b>{item.label}</b><p>{item.hint}</p></div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="fine">입력한 내용에서 찾은 항목은 미리 체크해 뒀어요. 실제 파일이 있는지는 직접 확인해 주세요.</p>
        </section>
      </div>

      <section className="sheet">
        <div className="sheet__head">
          <div className="sheet__h"><Icon name="card" size={14} /> {issuer ? `${issuer.name} ` : '카드사 '}이의신청서 미리 채우기</div>
          <button className="ghostbtn small" onClick={() => onCopy(formText, '신청서 항목')}><Icon name="copy" size={13} /> 항목 복사</button>
        </div>
        <table className="form-table">
          <tbody>
            {form.map(f => <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>)}
          </tbody>
        </table>
        <p className="fine">{issuer ? `${issuer.name} 양식은 접수 화면에서 받아서 위 항목을 옮겨 적으면 돼요.` : '카드사마다 양식과 접수 채널이 달라요. 위에서 카드사를 고르면 채널과 사유 이름을 맞춰 드려요.'}{merchant?.processor ? ' 결제대행 표기라서 실제 판매자 이름도 같이 적어야 해요.' : ''}</p>
      </section>

      <section className="ticket" aria-label="제출 초안">
        <div className="ticket__main">
          <div className="sheet__head">
            <div className="sheet__h"><Icon name="file" size={14} /> 제출 초안 · 검토용</div>
            <button className="ghostbtn small" onClick={() => onCopy(report.drafts[draft], DRAFT_LABEL[draft])}><Icon name="copy" size={13} /> 초안 복사</button>
          </div>
          <div className="doc-tabs" role="tablist">
            {(Object.keys(DRAFT_LABEL) as Draft[]).map(t => <button role="tab" aria-selected={draft === t} key={t} onClick={() => setDraft(t)}>{DRAFT_LABEL[t]}</button>)}
          </div>
          <pre className="draft">{report.drafts[draft]}</pre>
          <p className="fine">사실관계와 [직접 입력] 빈칸을 확인한 뒤 직접 보내 주세요. 분쟁72는 대신 보내거나 접수하지 않아요.</p>
        </div>
        <div className="perforation" aria-hidden="true"><span className="perforation__rule">Tear here · 이 부분은 보관해 두세요</span></div>
        <div className="stub">
          <p className="stub__keep">사건 파일 · 패키지 요약</p>
          <dl className="details" style={{ marginTop: 0 }}>
            <div className="details__cell"><dt>사건 번호</dt><dd><span className="mono">{number}</span></dd></div>
            <div className="details__cell"><dt>사유코드 후보</dt><dd><span className="mono">{mapping ? `${mapping.visa.code} / ${mapping.mastercard.code}` : '보류'}</span></dd></div>
            <div className="details__cell"><dt>증빙 준비도</dt><dd><span className="mono">{readiness.done}/{readiness.total}</span></dd></div>
            <div className="details__cell"><dt>참고 기한</dt><dd><span className="mono">{deadlineRef ? deadlineRef.due : '확인'}</span></dd></div>
          </dl>
          <div className="barcode" aria-hidden="true" />
          <p className="stub__num">{number.replace(/·/g, ' ')} · {parsed.transactionDate ? parsed.transactionDate.slice(5).replace('-', '·') : '--·--'}</p>
          <div className="stub__actions">
            <button className="inkbtn" onClick={onExport}>패키지 내보내기 <span className="hint">.MD</span></button>
            <button className="ghostbtn" onClick={() => onCopy(formText + '\n\n' + report.drafts.statement, '신청서와 사실 정리')}>상담용 복사</button>
          </div>
        </div>
      </section>
    </div>
  );
}
