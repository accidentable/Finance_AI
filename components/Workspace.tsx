'use client';

import { useRef } from 'react';
import { CASE_LABEL, PAYMENT_LABEL, STATUS_HINT, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, Phase, ReasonMapping } from '@/lib/playbook';
import type { Issuer } from '@/lib/knowledge';
import { MAX_IMAGES, imageFilesFrom, type ImageInput } from '@/lib/images';
import { Icon } from './Icon';
import { IssuerSelect } from './IssuerSelect';
import { Steps } from './Steps';
import { Reasoning } from './Reasoning';
import { Package } from './Package';

type Props = {
  result: CaseResult;
  revision: number;
  previous: CaseResult | null;
  onDismissPrevious: () => void;
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
  issuer: Issuer | null;
  issuerId: string;
  setIssuerId: (id: string) => void;
  followup: string;
  setFollowup: (v: string) => void;
  onFollowup: () => void;
  images: ImageInput[];
  onUpload: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
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
  const { result, merchant, deadlineRef } = p;
  const { parsed, report } = result;
  const upload = useRef<HTMLInputElement>(null);
  const dday = deadlineRef ? (deadlineRef.daysLeft < 0 ? `D+${Math.abs(deadlineRef.daysLeft)}` : `D-${deadlineRef.daysLeft}`) : '계산 전';
  const canSend = !p.busy && (p.followup.trim().length >= 5 || p.images.length > 0);

  return (
    <div className="page">
      <section className="ticket is-ready" key={`${parsed.title}-${p.revision}`} aria-label="지금 상황">
        <div className="ticket__main">
          <div className="nameplate">
            <p className="nameplate__class">{CASE_LABEL[parsed.caseType]} · v{p.revision}</p>
            <h1 className="nameplate__line">{report.headline}</h1>
            <p className="nameplate__sub">{report.explanation}</p>
          </div>
          <div className={`stamp ${result.mode === 'demo' ? 'demo' : ''}`} aria-hidden="true">
            <div className="stamp__inner"><span className="stamp__top">{result.mode === 'demo' ? '예시' : '분석 완료'}</span><span className="stamp__date">{stampDate()}</span><span className="stamp__bottom">분쟁72</span></div>
          </div>
          <dl className="details details--5">
            <div className="details__cell"><dt>가맹점</dt><dd>{merchant ? merchant.name : parsed.merchant || '미확인'}{parsed.descriptor && <code>{parsed.descriptor}</code>}</dd></div>
            <div className="details__cell"><dt>금액</dt><dd><span className="mono">{parsed.amount || '확인 필요'}</span></dd></div>
            <div className="details__cell details__cell--wide"><dt>결제 상태</dt><dd><span className={`pill status-${parsed.paymentStatus}`}>{PAYMENT_LABEL[parsed.paymentStatus]}</span><small>{STATUS_HINT[parsed.paymentStatus]}</small></dd></div>
            <div className="details__cell details__cell--select"><dt>카드사</dt><dd><IssuerSelect value={p.issuerId} onChange={p.setIssuerId} />{p.issuer && <code>{p.issuer.phone}</code>}</dd></div>
            <div className="details__cell"><dt>카드사 접수 기한</dt><dd className={deadlineRef && deadlineRef.daysLeft <= 30 ? 'urgent' : ''}><span className="mono">{dday}</span><code>{deadlineRef ? `${deadlineRef.due}까지 (참고치)` : '아래 3단계에서 거래일 입력'}</code></dd></div>
          </dl>
        </div>
      </section>

      {p.previous && (
        <div className="change-banner">
          <Icon name="link" size={16} />
          <span>새 내용을 반영해 다시 정리했어요 · {p.previous.parsed.paymentStatus !== parsed.paymentStatus ? `${PAYMENT_LABEL[p.previous.parsed.paymentStatus]} → ${PAYMENT_LABEL[parsed.paymentStatus]}` : `확인한 사실 ${p.previous.parsed.facts.length}개 → ${parsed.facts.length}개`}</span>
          <button className="iconbtn" onClick={p.onDismissPrevious} aria-label="갱신 알림 닫기"><Icon name="close" size={14} /></button>
        </div>
      )}

      <Steps result={result} plan={p.plan} checks={p.checks} toggle={p.toggle} txDate={p.txDate} setTxDate={p.setTxDate} deadlineRef={deadlineRef} issuer={p.issuer} onCopy={p.onCopy} />

      {report.questions.length > 0 && (
        <section className="sheet" id="questions" aria-label="확인해 주세요">
          <div className="sheet__h"><Icon name="alert" size={16} /> 답을 알면 더 정확해져요</div>
          <ul className="questions">
            {report.questions.map((q, i) => (
              <li key={i}>
                <div><b>{q.question}</b><p>{q.why}</p></div>
                <button className="ghostbtn small" onClick={() => p.onAnswer(q.question)}>답하기</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Reasoning result={result} merchant={merchant} />

      <section className="documents" id="documents" aria-label="카드사에 낼 서류">
        <div className="documents__head">
          <div className="sheet__h"><Icon name="file" size={16} /> 카드사에 낼 서류</div>
          <h2 className="todo__title">3단계에서 쓸 서류예요</h2>
          <p className="todo__sub">카드사를 고르면 접수 방법이 맞춰지고, 아래 초안은 복사해서 바로 쓸 수 있어요.</p>
        </div>
        <Package result={result} merchant={merchant} mapping={p.mapping} evidence={p.evidence} checks={p.checks} toggle={p.toggle} readiness={p.readiness} form={p.form} deadlineRef={deadlineRef} issuer={p.issuer} issuerId={p.issuerId} setIssuerId={p.setIssuerId} onCopy={p.onCopy} onExport={p.onExport} />
      </section>

      <div className="followup-area">
        {p.error && <p className="error" role="alert">{p.error}</p>}
        {p.images.length > 0 && (
          <ul className="thumbs followup__thumbs">
            {p.images.map((img, i) => (
              <li key={i} className="thumb">
                <img src={`data:${img.mime};base64,${img.data}`} alt={`첨부 사진 ${i + 1}`} />
                <button type="button" className="thumb__x" onClick={() => p.onRemoveImage(i)} aria-label={`첨부 사진 ${i + 1} 삭제`}><Icon name="close" size={12} /></button>
              </li>
            ))}
          </ul>
        )}
        <form className="followup" onSubmit={e => { e.preventDefault(); if (canSend) p.onFollowup(); }}>
          <button type="button" className="iconbtn followup__attach" onClick={() => upload.current?.click()} disabled={p.busy || p.images.length >= MAX_IMAGES} aria-label="사진 첨부" title="사진 첨부"><Icon name="camera" size={20} /></button>
          <textarea aria-label="새로운 단서 추가" value={p.followup} onChange={e => p.setFollowup(e.target.value)} maxLength={8000} placeholder="답장이나 사진을 추가해요" rows={1} onPaste={e => { const files = imageFilesFrom(e.clipboardData); if (files.length) { e.preventDefault(); p.onUpload(files); } }} />
          <button className="inkbtn" disabled={!canSend}>다시 분석 <Icon name="arrow" size={16} /></button>
        </form>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden ref={upload} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) p.onUpload(files); e.target.value = ''; }} />
      </div>
    </div>
  );
}
