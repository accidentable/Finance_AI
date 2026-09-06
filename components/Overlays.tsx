'use client';

import { useEffect, useRef } from 'react';
import type { ImageInput } from '@/lib/images';
import { Icon } from './Icon';

const STAGES = ['단서 읽기', '규정과 연결', '초안 정리'];

export function LoadingOverlay({ stage, progress, onCancel }: { stage: number; progress: string; onCancel: () => void }) {
  return (
    <div className="loading-overlay" role="status">
      <div className="loading-card">
        <div className="press" aria-hidden="true">분석 중</div>
        <h2>사건을 정리하고 있어요</h2>
        <p>{progress}</p>
        <div className="stage-list">
          {STAGES.map((s, i) => <span key={s} className={i <= stage ? 'current' : ''}>{i < stage ? <Icon name="check" size={13} /> : <i />}{s}</span>)}
        </div>
        <button className="textlink" onClick={onCancel}>그만두기</button>
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
        <div><span className="label label--stamp">보내기 전</span><h2>이 내용으로 보낼게요</h2></div>
        <button className="iconbtn" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
      </div>
      <p>전화번호, 이메일, API 키는 가렸어요. 남은 개인정보는 직접 지워 주세요.</p>
      <textarea aria-label="전송할 내용" value={review || ''} onChange={e => setReview(e.target.value)} maxLength={20000} />
      {images.length > 0 && (
        <div className="review-images">
          <ul className="thumbs">{images.map((img, i) => <li key={i} className="thumb"><img src={`data:${img.mime};base64,${img.data}`} alt={`첨부 사진 ${i + 1}`} /></li>)}</ul>
          <p className="attachments__hint">사진은 가려지지 않아요. 카드번호가 보이면 지우고 다시 올려 주세요.</p>
        </div>
      )}
      <div className="modal-foot">
        <button className="ghostbtn" onClick={onClose}>돌아가기</button>
        <button className="inkbtn" disabled={!ready} onClick={onConfirm}>분석하기 <Icon name="arrow" size={16} /></button>
      </div>
    </dialog>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast" role="status">{text}</div>;
}
