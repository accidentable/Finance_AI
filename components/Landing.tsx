'use client';

import { useRef } from 'react';
import { SAMPLES } from '@/lib/samples';
import { SLOT_META, type Slots } from '@/lib/case';
import { parseNotification } from '@/lib/knowledge';
import { MAX_IMAGES, type ImageInput } from '@/lib/images';
import { Icon } from './Icon';

const TYPE_LABEL = { approved: '해외승인', declined: '승인 거절', cancelled: '승인 취소' } as const;

function ParsedPreview({ text }: { text: string }) {
  if (!text.trim()) return null;
  const n = parseNotification(text);
  const parts = [n.issuer, n.type ? TYPE_LABEL[n.type] : null, n.currency && n.amount ? `${n.currency} ${n.amount}` : n.krw ? `${n.krw}원` : null, n.date ? `${n.date}${n.time ? ' ' + n.time : ''}` : null, n.descriptor].filter(Boolean);
  if (parts.length === 0 && !n.suspicious) return null;
  return (
    <div className={`slot__parsed ${n.suspicious ? 'warn' : ''}`}>
      <span className="label">{n.suspicious ? '주의' : '문자에서 읽었어요'}</span>
      {n.suspicious ? <span>국외·국제발신 문자예요. 링크는 누르지 말고 카드사 대표번호로 확인해 주세요.</span> : parts.map((p, i) => <span key={i} className="chip">{p}</span>)}
    </div>
  );
}

type Props = {
  slots: Slots;
  setSlot: (key: keyof Slots, value: string) => void;
  onSubmit: () => void;
  onSample: (index: number) => void;
  onUpload: (files: File[]) => void;
  images: ImageInput[];
  onRemoveImage: (index: number) => void;
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

export function Landing({ slots, setSlot, onSubmit, onSample, onUpload, images, onRemoveImage, saved, onRestore, error, busy, canSubmit }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  return (
    <div className="page page--narrow">
      <section className="ticket is-ready" aria-label="사건 접수">
        <div className="ticket__main">
          <div className="nameplate">
            <p className="nameplate__class">접수 · 첫 72시간</p>
            <h1 className="nameplate__line">어떤 결제 문제가<br />있었나요?</h1>
            <p className="nameplate__sub">해외 AI·클라우드·구독 결제가 이상하다면, 있는 자료만 넣어도 괜찮아요</p>
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
                {m.key === 'sms' && <ParsedPreview text={slots.sms} />}
              </label>
            ))}
            <div className="attachments">
              <div className="attachments__head">
                <span className="slot__h"><Icon name="file" size={14} />사진 · 텍스트 파일<span className="right">{images.length}/{MAX_IMAGES}장</span></span>
                <button type="button" className="ghostbtn small" onClick={() => upload.current?.click()} disabled={images.length >= MAX_IMAGES}><Icon name="plus" size={14} /> 사진·txt 추가</button>
              </div>
              {images.length > 0 && (
                <ul className="thumbs">
                  {images.map((img, i) => (
                    <li key={i} className="thumb">
                      <img src={`data:${img.mime};base64,${img.data}`} alt={`첨부 사진 ${i + 1}`} />
                      <button type="button" className="thumb__x" onClick={() => onRemoveImage(i)} aria-label={`첨부 사진 ${i + 1} 삭제`}><Icon name="close" size={11} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="attachments__hint">카드 문자나 청구 화면을 캡처해 올리면 글자를 읽어서 같이 분석해요. 사진은 자동으로 가려지지 않으니 카드번호와 이름은 지우고 올려 주세요.</p>
            </div>
            <div className="entry__actions">
              <span className="entry__note"><Icon name="shield" size={14} /> 보내기 전에 가려진 내용을 먼저 보여드려요</span>
              <div className="entry__tools">
                <button type="submit" className="inkbtn" disabled={busy || !canSubmit}>분석 시작 <span className="hint">Ctrl + Enter</span></button>
              </div>
            </div>
          </form>
          {error && <p className="error" role="alert">{error}</p>}
        </div>

        <div className="perforation" aria-hidden="true"><span className="perforation__rule">예시 사건 · 바로 열어볼 수 있어요</span></div>

        <div className="stub is-ready">
          <p className="stub__keep">미리 만들어 둔 예시 · AI 호출 없음</p>
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
        <h2 className="conditions__h">이렇게 써 보세요</h2>
        <p>카드 알림 문자가 제일 중요해요. 거래일, 금액, 가맹점 표기가 거기서 나와요. 청구 메일은 보낸 주소까지 같이 넣으면 진짜 보낸 곳인지 대조해요. 전화번호, 이메일, API 키 모양은 보내기 전에 자동으로 가려요.</p>
        <p>분쟁72는 상황을 정리하고 서류를 준비하는 데까지 도와요. 보내고 접수하는 건 직접 결정해요. 결과는 검토용이고, 환불 권리나 신청 기한을 확정하지 않아요.</p>
      </section>

      <footer className="colophon">
        <p className="colophon__mark">분쟁72</p>
        <p className="colophon__fine">해외결제 이상청구 대응 비서 · 2026 금융 AI Challenge</p>
      </footer>

      <input type="file" accept=".txt,text/plain,image/jpeg,image/png,image/webp" multiple hidden ref={upload} onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) onUpload(files); e.target.value = ''; }} />
    </div>
  );
}
