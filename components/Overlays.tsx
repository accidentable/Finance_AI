'use client';

import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

const STAGES = ['단서·신호 읽기', '규정과 연결', '초안 정리'];

export function LoadingOverlay({ stage, progress, onCancel }: { stage: number; progress: string; onCancel: () => void }) {
  return (
    <div className="loading-overlay" role="status">
      <div className="loading-card">
        <div className="orbit"><span /><span /><span /><i /></div>
        <span className="eyebrow">ANALYZING</span>
        <h2>사건의 연결 고리를 찾고 있어요</h2>
        <p>{progress}</p>
        <div className="stage-list">
          {STAGES.map((s, i) => <span key={s} className={i <= stage ? 'current' : ''}>{i < stage ? <Icon name="check" size={13} /> : <i />}{s}</span>)}
        </div>
        <button className="text-button" onClick={onCancel}>분석 취소</button>
      </div>
    </div>
  );
}

export function ReviewDialog({ review, setReview, onConfirm, onClose }: { review: string | null; setReview: (v: string) => void; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (review !== null) ref.current?.showModal(); else ref.current?.close(); }, [review]);
  return (
    <dialog ref={ref} className="modal review-modal" onCancel={onClose}>
      <div className="modal-head">
        <div><span className="eyebrow">BEFORE SENDING</span><h2>보낼 내용을 확인해 주세요</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="전송 확인 닫기"><Icon name="close" /></button>
      </div>
      <p>번호, 이메일, API 키 형태는 자동으로 숨겼어요. 이름·주소 등 남은 개인정보는 직접 지워 주세요. 아래 텍스트가 OpenAI API로 전송됩니다.</p>
      <textarea aria-label="전송할 내용 확인" value={review || ''} onChange={e => setReview(e.target.value)} maxLength={20000} />
      <div className="modal-foot">
        <span>자동 마스킹은 완전한 익명화를 보장하지 않습니다.</span>
        <button className="solid" disabled={!review || review.trim().length < 20} onClick={onConfirm}>이 내용으로 분석 <Icon name="arrow" /></button>
      </div>
    </dialog>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return <div className="toast" role="status">{text}</div>;
}
