'use client';

import { useEffect, useRef } from 'react';
import type { ImageInput } from '@/lib/images';
import { Icon } from './Icon';

const STAGES = ['단서·신호 읽기', '규정과 연결', '초안 정리'];

export function LoadingOverlay({ stage, progress, onCancel }: { stage: number; progress: string; onCancel: () => void }) {
  return (
    <div className="loading-overlay" role="status">
      <div className="loading-card">
        <div className="press" aria-hidden="true">분석 중</div>
        <h2>사건 파일을 인쇄하고 있어요</h2>
        <p>{progress}</p>
        <div className="stage-list">
          {STAGES.map((s, i) => <span key={s} className={i <= stage ? 'current' : ''}>{i < stage ? <Icon name="check" size={11} /> : <i />}{s}</span>)}
        </div>
        <button className="textlink" onClick={onCancel}>분석 취소</button>
      </div>
    </div>
  );
}

export function ReviewDialog({ review, setReview, onConfirm, onClose, images = [] }: { review: string | null; setReview: (v: string) => void; onConfirm: () => void; onClose: () => void; images?: ImageInput[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (review !== null) ref.current?.showModal(); else ref.current?.close(); }, [review]);
  const ready = (review?.trim().length ?? 0) >= 20 || (images.length > 0 && review !== null);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-head">
        <div><span className="label label--stamp">Before sending</span><h2>보낼 내용을 확인해 주세요</h2></div>
        <button className="iconbtn" onClick={onClose} aria-label="전송 확인 닫기"><Icon name="close" /></button>
      </div>
      <p>번호, 이메일, API 키 형태는 자동으로 가렸어요. 이름·주소 등 남은 개인정보는 직접 지워 주세요. 아래 텍스트{images.length > 0 ? `와 첨부 사진 ${images.length}장` : ''}이 OpenAI API로 전송됩니다.</p>
      <textarea aria-label="전송할 내용 확인" value={review || ''} onChange={e => setReview(e.target.value)} maxLength={20000} />
      {images.length > 0 && (
        <div className="review-images">
          <ul className="thumbs">{images.map((img, i) => <li key={i} className="thumb"><img src={`data:${img.mime};base64,${img.data}`} alt={`첨부 사진 ${i + 1}`} /></li>)}</ul>
          <p className="attachments__hint">사진은 마스킹되지 않습니다. 카드번호나 이름이 보이면 닫고 가린 뒤 다시 올려 주세요. 사진 속 글자는 서버에서 옮겨 적은 뒤 마스킹합니다.</p>
        </div>
      )}
      <div className="modal-foot">
        <span>자동 마스킹은 완전한 익명화를 보장하지 않습니다</span>
        <button className="inkbtn" disabled={!ready} onClick={onConfirm}>이 내용으로 분석 <span className="hint">Send</span></button>
      </div>
    </dialog>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast" role="status">{text}</div>;
}
