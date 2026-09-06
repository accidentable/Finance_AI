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
        <div className="sheet__h"><Icon name="building" size={16} /> 카드사 접수 안내</div>
        <p>카드사를 고르면 접수 채널과 기한을 보여드려요.</p>
        <div className="issuer-pick"><IssuerSelect value={issuerId} onChange={setIssuerId} /></div>
      </section>
    );
  }
  const reason = issuerReasonFor(issuer, result.parsed.caseType);
  return (
    <section className="sheet">
      <div className="sheet__head">
        <div className="sheet__h"><Icon name="building" size={16} /> {issuer.name} 이의신청</div>
        <span className={`verify-badge ${issuer.verified}`}>{VERIFIED_LABEL[issuer.verified]}</span>
      </div>
      <dl className="details guide-details">
        <div className="details__cell"><dt>고객센터</dt><dd><span className="mono">{issuer.phone}</span></dd></div>
        <div className="details__cell"><dt>기한</dt><dd className="small">{issuer.deadline}</dd></div>
        <div className="details__cell"><dt>처리 기간</dt><dd className="small">{issuer.processing}</dd></div>
        <div className="details__cell"><dt>사유 이름</dt><dd className="small">{reason ?? '가장 가까운 항목 선택'}</dd></div>
      </dl>
      <div className="grid-2 guide-grid">
        <div>
          <p className="label label--strong">접수 채널</p>
          <ul className="guide-list">
            {issuer.channels.map((c, i) => (
              <li key={i}>
                <span className="pill">{CHANNEL_LABEL[c.type] ?? c.type}</span>
                <span>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.label} <Icon name="external" size={12} /></a> : c.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {issuer.documents.length > 0 && (
            <>
              <p className="label label--strong">필요한 서류</p>
              <ul className="guide-list">
                {issuer.documents.map(d => <li key={d}><span className="dot" />{d}</li>)}
              </ul>
            </>
          )}
          {issuer.reasons.length > 0 && (
            <details className="more">
              <summary>카드사 사유 목록 {issuer.reasons.length}개</summary>
              <ul className="guide-list">
                {issuer.reasons.map(r => <li key={r} className={r === reason ? 'hit' : ''}><span className="dot" />{r}</li>)}
              </ul>
            </details>
          )}
        </div>
      </div>
      {issuer.notes.length > 0 && (
        <ul className="guide-notes">
          {issuer.notes.map(n => <li key={n}><Icon name="alert" size={14} />{n}</li>)}
        </ul>
      )}
      <p className="sources">출처: {issuer.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
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
          <div className="sheet__h"><Icon name="scale" size={16} /> 사유코드 후보</div>
          <p className="type-line">유형 <b>{CASE_LABEL[parsed.caseType]}</b></p>
          {mapping ? (
            <>
              <div className="fare">
                <p className="fare__line"><span>Visa · {mapping.visa.name}</span><span className="mono">{mapping.visa.code}</span></p>
                <p className="fare__line"><span>Mastercard · {mapping.mastercard.name}</span><span className="mono">{mapping.mastercard.code}</span></p>
                <p className="fare__line fare__line--total"><span>가맹점 선행 접촉 기록</span><span className="mono">필수</span></p>
              </div>
              <div className="caution"><Icon name="alert" size={16} /><p>{mapping.caution}</p></div>
            </>
          ) : (
            <p className="empty">유형이 정해지면 후보가 나와요.</p>
          )}
          <p className="fine">상담용 후보예요. 최종 결정은 카드사가 해요.</p>
        </section>

        <section className="sheet">
          <div className="sheet__h"><Icon name="check" size={16} /> 증빙 준비</div>
          <div className="readiness"><b>{readiness.pct}%</b><span>{readiness.done} / {readiness.total}</span></div>
          <div className="meter big"><div style={{ width: `${readiness.pct}%` }} /></div>
          {evidence.length === 0 ? <p className="empty">유형이 정해지면 체크리스트가 생겨요.</p> : (
            <ul className="checks">
              {evidence.map(item => {
                const id = `ev:${item.id}`;
                return (
                  <li key={id} className={checks[id] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="box" aria-hidden="true"><Icon name="check" size={13} /></span>
                      <div><b>{item.label}</b><p>{item.hint}</p></div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="sheet">
        <div className="sheet__head">
          <div className="sheet__h"><Icon name="card" size={16} /> 신청서 항목</div>
          <button className="ghostbtn small" onClick={() => onCopy(formText, '신청서 항목')}><Icon name="copy" size={15} /> 복사</button>
        </div>
        <table className="form-table">
          <tbody>
            {form.map(f => <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>)}
          </tbody>
        </table>
        {merchant?.processor && <p className="fine">결제대행 표기라서 실제 판매자 이름도 같이 적어요.</p>}
      </section>

      <section className="ticket" aria-label="제출 초안">
        <div className="ticket__main">
          <div className="sheet__head">
            <div className="sheet__h"><Icon name="file" size={16} /> 초안</div>
            <button className="ghostbtn small" onClick={() => onCopy(report.drafts[draft], DRAFT_LABEL[draft])}><Icon name="copy" size={15} /> 복사</button>
          </div>
          <div className="doc-tabs" role="tablist">
            {(Object.keys(DRAFT_LABEL) as Draft[]).map(t => <button role="tab" aria-selected={draft === t} key={t} onClick={() => setDraft(t)}>{DRAFT_LABEL[t]}</button>)}
          </div>
          <pre className="draft">{report.drafts[draft]}</pre>
          <p className="fine">[직접 입력] 칸을 채운 뒤 직접 보내 주세요.</p>
        </div>
        <div className="perforation" aria-hidden="true"><span className="perforation__rule">사건 요약</span></div>
        <div className="stub">
          <dl className="details" style={{ marginTop: 0 }}>
            <div className="details__cell"><dt>사건 번호</dt><dd><span className="mono">{number}</span></dd></div>
            <div className="details__cell"><dt>사유코드</dt><dd><span className="mono">{mapping ? `${mapping.visa.code} / ${mapping.mastercard.code}` : '보류'}</span></dd></div>
            <div className="details__cell"><dt>증빙</dt><dd><span className="mono">{readiness.done}/{readiness.total}</span></dd></div>
            <div className="details__cell"><dt>참고 기한</dt><dd><span className="mono">{deadlineRef ? deadlineRef.due : '확인'}</span></dd></div>
          </dl>
          <div className="barcode" aria-hidden="true" />
          <p className="stub__num">{number.replace(/·/g, ' ')} · {parsed.transactionDate ? parsed.transactionDate.slice(5).replace('-', '·') : '--·--'}</p>
          <div className="stub__actions">
            <button className="inkbtn" onClick={onExport}>패키지 내려받기 <Icon name="download" size={16} /></button>
            <button className="ghostbtn" onClick={() => onCopy(formText + '\n\n' + report.drafts.statement, '신청서와 사실 정리')}>상담용 복사</button>
          </div>
        </div>
      </section>
    </div>
  );
}
