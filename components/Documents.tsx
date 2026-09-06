'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CASE_LABEL, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, ReasonMapping } from '@/lib/playbook';
import { VERIFIED_LABEL, issuerReasonFor, type Issuer } from '@/lib/knowledge';
import { Icon } from './Icon';
import { IssuerSelect } from './IssuerSelect';

type Draft = 'email' | 'statement' | 'timeline';
const DRAFT_LABEL: Record<Draft, string> = { email: '가맹점에 보낼 영문 메일', statement: '카드사 상담용 정리', timeline: '날짜순 정리' };
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
  issuer: Issuer | null;
  issuerId: string;
  setIssuerId: (id: string) => void;
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
};

type Panel = 'issuer' | 'form' | 'drafts' | 'evidence' | null;

// 서류는 필요할 때만 모달로 연다. 본문에는 요약 한 줄과 버튼만 둔다.
function Sheet({ open, title, onClose, children, action }: { open: boolean; title: string; onClose: () => void; children: ReactNode; action?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) ref.current?.showModal(); else ref.current?.close(); }, [open]);
  return (
    <dialog ref={ref} className="modal modal--wide" onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="iconbtn" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
      </div>
      <div className="modal-body">{open && children}</div>
      {action && <div className="modal-foot">{action}</div>}
    </dialog>
  );
}

export function Documents({ result, merchant, mapping, evidence, checks, toggle, readiness, form, issuer, issuerId, setIssuerId, onCopy, onExport }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<Draft>('email');
  const { parsed, report } = result;
  const formText = form.map(f => `${f.label}: ${f.value}`).join('\n');
  const reason = issuer ? issuerReasonFor(issuer, parsed.caseType) : null;
  const web = issuer?.channels.find(c => c.type === 'web' && c.url);
  const close = () => setPanel(null);

  return (
    <section className="sheet documents" id="documents" aria-label="카드사에 낼 서류">
      <div className="sheet__h"><Icon name="file" size={16} /> 카드사에 낼 서류</div>
      <div className="documents__issuer">
        {issuer ? (
          <>
            <div className="documents__line">
              <b>{issuer.name}</b>
              <span className="mono">{issuer.phone}</span>
              <span className={`verify-badge ${issuer.verified}`}>{VERIFIED_LABEL[issuer.verified]}</span>
            </div>
            <p className="documents__meta">기한: {issuer.deadline}{reason ? ` · 접수 사유: ${reason}` : ''}</p>
          </>
        ) : (
          <div className="documents__line">
            <span>어느 카드로 결제했나요?</span>
            <IssuerSelect value={issuerId} onChange={setIssuerId} />
          </div>
        )}
      </div>

      <div className="documents__grid">
        <button className="doc-tile" onClick={() => setPanel('drafts')}>
          <Icon name="mail" size={20} />
          <b>보낼 글 보기</b>
          <span>영문 메일 · 상담용 정리 · 날짜순</span>
        </button>
        <button className="doc-tile" onClick={() => setPanel('form')}>
          <Icon name="card" size={20} />
          <b>신청서에 적을 내용</b>
          <span>{form.length}개 항목 · 복사해서 붙여넣기</span>
        </button>
        <button className="doc-tile" onClick={() => setPanel('evidence')}>
          <Icon name="check" size={20} />
          <b>모아야 할 증빙</b>
          <span>{readiness.done}/{readiness.total} 준비 · 분쟁 사유 포함</span>
        </button>
        <button className="doc-tile" onClick={() => setPanel('issuer')} disabled={!issuer}>
          <Icon name="building" size={20} />
          <b>{issuer ? `${issuer.name} 접수 방법` : '카드사를 먼저 골라 주세요'}</b>
          <span>{issuer ? `접수 채널 ${issuer.channels.length}개${issuer.documents.length ? ` · 필요 서류 ${issuer.documents.length}개` : ''}` : '접수 채널과 필요 서류'}</span>
        </button>
      </div>
      <div className="documents__foot">
        {web && <a className="ghostbtn" href={web.url} target="_blank" rel="noopener noreferrer">{issuer!.name} 접수 화면 열기 <Icon name="external" size={14} /></a>}
        <button className="ghostbtn" onClick={onExport}><Icon name="download" size={16} /> 전부 파일로 내려받기</button>
      </div>

      <Sheet open={panel === 'drafts'} title={DRAFT_LABEL[draft]} onClose={close}
        action={<button className="inkbtn" onClick={() => onCopy(report.drafts[draft], DRAFT_LABEL[draft])}><Icon name="copy" size={16} /> 이 글 복사</button>}>
        <div className="doc-tabs" role="tablist">
          {(Object.keys(DRAFT_LABEL) as Draft[]).map(t => <button role="tab" aria-selected={draft === t} key={t} onClick={() => setDraft(t)}>{DRAFT_LABEL[t]}</button>)}
        </div>
        <pre className="draft">{report.drafts[draft]}</pre>
        <p className="fine">[직접 입력] 칸을 채운 뒤 직접 보내 주세요.</p>
      </Sheet>

      <Sheet open={panel === 'form'} title={issuer ? `${issuer.name} 신청서에 적을 내용` : '신청서에 적을 내용'} onClose={close}
        action={<button className="inkbtn" onClick={() => onCopy(formText, '신청서 항목')}><Icon name="copy" size={16} /> 전체 복사</button>}>
        <table className="form-table">
          <tbody>{form.map(f => <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>)}</tbody>
        </table>
        {merchant?.processor && <p className="fine">결제대행 표기라서 실제 판매자 이름도 같이 적어요.</p>}
      </Sheet>

      <Sheet open={panel === 'evidence'} title="모아야 할 증빙" onClose={close}>
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
        {mapping && (
          <details className="more">
            <summary>카드사에 말할 분쟁 사유 · {CASE_LABEL[parsed.caseType]}</summary>
            <div className="fare">
              <p className="fare__line"><span>Visa · {mapping.visa.name}</span><span className="mono">{mapping.visa.code}</span></p>
              <p className="fare__line"><span>Mastercard · {mapping.mastercard.name}</span><span className="mono">{mapping.mastercard.code}</span></p>
            </div>
            <div className="caution"><Icon name="alert" size={16} /><p>{mapping.caution}</p></div>
            <p className="fine">상담 때 "이 사유로 접수하고 싶다"고 말하면 돼요. 최종 분류는 카드사가 해요.</p>
          </details>
        )}
      </Sheet>

      {issuer && (
        <Sheet open={panel === 'issuer'} title={`${issuer.name} 해외이용 이의신청`} onClose={close}
          action={web ? <a className="inkbtn" href={web.url} target="_blank" rel="noopener noreferrer">접수 화면 열기 <Icon name="external" size={14} /></a> : undefined}>
          <dl className="details guide-details">
            <div className="details__cell"><dt>고객센터</dt><dd><span className="mono">{issuer.phone}</span></dd></div>
            <div className="details__cell"><dt>기한</dt><dd className="small">{issuer.deadline}</dd></div>
            <div className="details__cell"><dt>처리 기간</dt><dd className="small">{issuer.processing}</dd></div>
            <div className="details__cell"><dt>사유 이름</dt><dd className="small">{reason ?? '가장 가까운 항목 선택'}</dd></div>
          </dl>
          <p className="label label--strong">접수 채널</p>
          <ul className="guide-list">
            {issuer.channels.map((c, i) => (
              <li key={i}><span className="pill">{CHANNEL_LABEL[c.type] ?? c.type}</span><span>{c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer">{c.label} <Icon name="external" size={12} /></a> : c.label}</span></li>
            ))}
          </ul>
          {issuer.documents.length > 0 && (
            <>
              <p className="label label--strong">필요한 서류</p>
              <ul className="guide-list">{issuer.documents.map(d => <li key={d}><span className="dot" />{d}</li>)}</ul>
            </>
          )}
          {issuer.notes.length > 0 && <ul className="guide-notes">{issuer.notes.map(n => <li key={n}><Icon name="alert" size={14} />{n}</li>)}</ul>}
          <p className="sources">출처: {issuer.sources.map((s, i) => <span key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></span>)}</p>
        </Sheet>
      )}
    </section>
  );
}
