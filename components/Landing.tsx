'use client';

import { useRef } from 'react';
import { SAMPLES } from '@/lib/samples';
import { SLOT_META, type Slots } from '@/lib/case';
import { Icon } from './Icon';

type Props = {
  slots: Slots;
  setSlot: (key: keyof Slots, value: string) => void;
  onSubmit: () => void;
  onSample: (index: number) => void;
  onUpload: (file: File) => void;
  saved: boolean;
  onRestore: () => void;
  error: string;
  busy: boolean;
  canSubmit: boolean;
};

const SLOT_ICON: Record<keyof Slots, 'card' | 'mail' | 'file'> = { sms: 'card', mail: 'mail', note: 'file' };

function today() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}·${String(d.getDate()).padStart(2, '0')}`;
}

export function Landing({ slots, setSlot, onSubmit, onSample, onUpload, saved, onRestore, error, busy, canSubmit }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  return (
    <div className="page page--narrow">
      <section className="ticket is-ready" aria-label="사건 접수">
        <div className="ticket__main">
          <div className="nameplate">
            <p className="nameplate__class">접수 · 첫 72시간</p>
            <h1 className="nameplate__line">어떤 결제 문제가<br />있었나요?</h1>
            <p className="nameplate__sub">해외 AI·클라우드·구독 결제의 이상 청구 대응 · 있는 자료만 채워도 됩니다</p>
          </div>
          <div className="stamp" aria-hidden="true"><div className="stamp__inner"><span className="stamp__top">접수 창구</span><span className="stamp__date">{today()}</span><span className="stamp__bottom">분쟁72</span></div></div>

          <form className="slots" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
            {SLOT_META.map((m, i) => (
              <label key={m.key} className={`slot ${i === 0 ? 'slot--primary' : ''}`}>
                <span className="slot__h"><Icon name={SLOT_ICON[m.key]} size={14} />{m.label}<span className="right">{m.hint}</span></span>
                <textarea
                  value={slots[m.key]}
                  onChange={e => setSlot(m.key, e.target.value)}
                  placeholder={m.placeholder}
                  maxLength={12000}
                  rows={i === 0 ? 4 : 2}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
                />
              </label>
            ))}
            <div className="entry__actions">
              <span className="entry__note"><Icon name="shield" size={14} /> 보내기 전에 마스킹 결과를 확인합니다</span>
              <div className="entry__tools">
                <button type="button" className="ghostbtn small" onClick={() => upload.current?.click()}><Icon name="plus" size={14} /> .txt 추가</button>
                <button type="submit" className="inkbtn" disabled={busy || !canSubmit}>분석 시작 <span className="hint">Ctrl + Enter</span></button>
              </div>
            </div>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="perforation" aria-hidden="true"><span className="perforation__rule">예시 사건 · 키 없이 열람</span></div>

        <div className="stub is-ready">
          <p className="stub__keep">합성 사례 · API 호출 없음</p>
          <div className="samples">
            {SAMPLES.map((s, i) => (
              <button type="button" key={s.id} className="sample" onClick={() => onSample(i)}>
                <span className="sample__code">Case · 0{i + 1}</span>
                <b>{s.label}</b>
                <small>{s.caption}</small>
                <span className="textlink">열어보기 →</span>
              </button>
            ))}
          </div>
          {saved && <button className="ghostbtn resume" onClick={onRestore}><Icon name="clock" size={14} /> 저장한 사건 이어보기</button>}
        </div>
      </section>

      <section className="conditions">
        <h2 className="conditions__h">이용 안내</h2>
        <p>카드 알림 문자가 가장 중요한 자료입니다. 거래일, 금액, 가맹점 표기가 거기서 나옵니다. 청구 메일은 발신 주소까지 함께 붙여넣으면 도메인을 대조합니다. 번호·이메일·API 키 형태는 전송 전에 자동으로 가립니다.</p>
        <p>이 서비스는 진단과 서류 준비까지 돕습니다. 발송과 카드사 접수는 직접 결정하세요. 결과는 검토용이며 환불 권리나 신청 기한을 확정하지 않습니다.</p>
      </section>

      <footer className="colophon">
        <p className="colophon__mark">분쟁72</p>
        <p className="colophon__fine">해외결제 이상청구 대응 비서 · 2026 금융 AI Challenge</p>
      </footer>

      <input type="file" accept=".txt,text/plain" hidden ref={upload} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
}
