'use client';

import { useState } from 'react';
import { CASE_LABEL, type CaseResult } from '@/lib/case';
import type { EvidenceItem, Merchant, ReasonMapping } from '@/lib/playbook';
import { Icon } from './Icon';

type Draft = 'email' | 'statement' | 'timeline';
const DRAFT_LABEL: Record<Draft, string> = { email: '영문 문의 메일', statement: '국문 사실 정리', timeline: '타임라인' };

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

export function Package({ result, merchant, mapping, evidence, checks, toggle, readiness, form, deadlineRef, onCopy, onExport }: Props) {
  const [draft, setDraft] = useState<Draft>('email');
  const { parsed, report } = result;
  const formText = form.map(f => `${f.label}: ${f.value}`).join('\n');
  const number = caseNumber(parsed.title, parsed.transactionDate);
  return (
    <div className="stage">
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
            <p className="empty">유형이 확정되지 않아 사유코드를 고르지 않았습니다. 진단 단계의 질문에 답하고 다시 분석하면 후보가 나옵니다.</p>
          )}
          <p className="fine">확정이 아니라 상담용 후보입니다. 카드사가 국제브랜드 규정에 따라 최종 결정합니다.</p>
        </section>

        <section className="sheet">
          <div className="sheet__h"><Icon name="check" size={14} /> 증빙 준비도</div>
          <div className="readiness"><b>{readiness.pct}%</b><span>{readiness.done} / {readiness.total} 준비됨</span></div>
          <div className="meter big"><div style={{ width: `${readiness.pct}%` }} /></div>
          {evidence.length === 0 ? <p className="empty">유형이 정해지면 체크리스트가 생깁니다.</p> : (
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
          <p className="fine">입력한 단서에서 찾은 항목은 미리 체크했습니다. 실제 파일을 확보했는지 직접 확인하세요.</p>
        </section>
      </div>

      <section className="sheet">
        <div className="sheet__head">
          <div className="sheet__h"><Icon name="card" size={14} /> 카드사 이의신청서 미리 채우기</div>
          <button className="ghostbtn small" onClick={() => onCopy(formText, '신청서 항목')}><Icon name="copy" size={13} /> 항목 복사</button>
        </div>
        <table className="form-table">
          <tbody>
            {form.map(f => <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>)}
          </tbody>
        </table>
        <p className="fine">카드사마다 양식과 접수 채널이 다릅니다. 카드사 앱의 해외이용 이의신청 메뉴나 고객센터에서 양식을 받아 위 항목을 옮겨 적으세요.{merchant?.processor ? ' 결제대행 표기라서 실제 판매자 이름을 함께 적어야 합니다.' : ''}</p>
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
          <p className="fine">사실관계와 [직접 입력] 빈칸을 검토한 뒤 직접 보내세요. 이 서비스는 발송과 접수를 대신하지 않습니다.</p>
        </div>
        <div className="perforation" aria-hidden="true"><span className="perforation__rule">Tear here · 이 부분을 보관하세요</span></div>
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
