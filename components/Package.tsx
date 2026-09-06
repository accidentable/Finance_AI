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
  onCopy: (text: string, label: string) => void;
  onExport: () => void;
};

export function Package({ result, merchant, mapping, evidence, checks, toggle, readiness, form, onCopy, onExport }: Props) {
  const [draft, setDraft] = useState<Draft>('email');
  const { parsed, report } = result;
  const formText = form.map(f => `${f.label}: ${f.value}`).join('\n');
  return (
    <div className="stage">
      <div className="grid-2">
        <section className="card">
          <h3><Icon name="scale" size={17} /> 사유코드 후보</h3>
          <p className="type-line">사건 유형 <b>{CASE_LABEL[parsed.caseType]}</b></p>
          {mapping ? (
            <>
              <div className="codes">
                <div><small>Visa</small><b>{mapping.visa.code}</b><span>{mapping.visa.name}</span></div>
                <div><small>Mastercard</small><b>{mapping.mastercard.code}</b><span>{mapping.mastercard.name}</span></div>
              </div>
              <p>{mapping.summary}</p>
              <div className="caution"><Icon name="alert" size={15} /><p>{mapping.caution}</p></div>
            </>
          ) : (
            <p className="empty">유형이 확정되지 않아 사유코드를 고르지 않았습니다. 진단 단계의 질문에 답하고 다시 분석하면 후보가 나옵니다.</p>
          )}
          <p className="fine">확정이 아니라 상담용 후보입니다. 카드사가 국제브랜드 규정에 따라 최종 결정하며, 가맹점과 먼저 해결을 시도한 기록이 필요합니다.</p>
        </section>

        <section className="card">
          <h3><Icon name="check" size={17} /> 증빙 준비도</h3>
          <div className="readiness"><b>{readiness.pct}%</b><span>{readiness.done}/{readiness.total} 준비됨</span></div>
          <div className="meter big"><div style={{ width: `${readiness.pct}%` }} /></div>
          {evidence.length === 0 ? <p className="empty">유형이 정해지면 체크리스트가 생깁니다.</p> : (
            <ul className="evidence">
              {evidence.map(item => {
                const id = `ev:${item.id}`;
                return (
                  <li key={id} className={checks[id] ? 'done' : ''}>
                    <label>
                      <input type="checkbox" checked={!!checks[id]} onChange={() => toggle(id)} />
                      <span className="checkbox" aria-hidden="true"><Icon name="check" size={12} /></span>
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

      <section className="card">
        <div className="card-head">
          <h3><Icon name="card" size={17} /> 카드사 이의신청서 미리 채우기</h3>
          <button className="outline small" onClick={() => onCopy(formText, '신청서 항목')}><Icon name="copy" size={14} /> 항목 복사</button>
        </div>
        <table className="form-table">
          <tbody>
            {form.map(f => <tr key={f.label}><th>{f.label}</th><td>{f.value}</td></tr>)}
          </tbody>
        </table>
        <p className="fine">카드사마다 양식과 접수 채널이 다릅니다. 카드사 앱의 해외이용 이의신청 메뉴나 고객센터에서 양식을 받아 위 항목을 옮겨 적으세요.{merchant?.processor ? ' 결제대행 표기라서 실제 판매자 이름을 함께 적어야 합니다.' : ''}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h3><Icon name="file" size={17} /> 제출 초안</h3>
          <button className="outline small" onClick={() => onCopy(report.drafts[draft], DRAFT_LABEL[draft])}><Icon name="copy" size={14} /> 초안 복사</button>
        </div>
        <div className="doc-tabs" role="tablist">
          {(Object.keys(DRAFT_LABEL) as Draft[]).map(t => <button role="tab" aria-selected={draft === t} key={t} onClick={() => setDraft(t)}>{DRAFT_LABEL[t]}</button>)}
        </div>
        <pre className="draft">{report.drafts[draft]}</pre>
        <p className="fine">사실관계와 [직접 입력] 빈칸을 검토한 뒤 직접 보내세요. 이 서비스는 발송과 접수를 대신하지 않습니다.</p>
      </section>

      <div className="export-row">
        <button className="solid" onClick={onExport}><Icon name="download" size={15} /> 패키지 내보내기 (Markdown)</button>
        <span>진단, 계획, 사유코드, 체크리스트, 신청서 항목, 초안이 한 파일로 저장됩니다.</span>
      </div>
    </div>
  );
}
