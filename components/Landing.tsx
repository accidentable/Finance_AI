'use client';

import { useRef } from 'react';
import { SAMPLES } from '@/lib/samples';
import { Icon } from './Icon';

type Props = {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (text: string) => void;
  onSample: (index: number) => void;
  onUpload: (file: File) => void;
  saved: boolean;
  onRestore: () => void;
  error: string;
  busy: boolean;
};

const STEPS = [
  { n: '01', title: '탐지·진단', text: '이상 신호를 찾고 가맹점 표기를 해독합니다' },
  { n: '02', title: '72시간 계획', text: '지혈, 가맹점 환불, 카드사 준비 순서로 안내합니다' },
  { n: '03', title: '이의신청 패키지', text: '사유코드 후보와 증빙 체크리스트, 초안을 만듭니다' },
];

export function Landing({ input, setInput, onSubmit, onSample, onUpload, saved, onRestore, error, busy }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  return (
    <main className="landing">
      <div className="entry">
        <div className="entry-caption"><span className="tiny-dot" /> 해외 AI·클라우드·구독 결제가 이상할 때, 첫 72시간</div>
        <h1>어떤 결제 문제가 있었나요?</h1>
        <form className="composer" onSubmit={e => { e.preventDefault(); onSubmit(input); }}>
          <textarea
            aria-label="사건 내용"
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={20000}
            placeholder={'카드 알림 문자, 청구 메일, 거래내역을 붙여넣어 주세요.\n지금 겪고 있는 일을 편하게 적어도 좋아요.'}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onSubmit(input); } }}
          />
          <div className="composer-bottom">
            <div className="composer-tools">
              <button type="button" className="icon-button" onClick={() => upload.current?.click()} aria-label="텍스트 파일 추가" title="텍스트 파일 추가 (.txt)"><Icon name="plus" /></button>
              <span className="tool-divider" />
              <span className="composer-hint"><Icon name="shield" size={13} /> 보내기 전에 마스킹 결과를 확인합니다</span>
            </div>
            <button className="send" disabled={busy || input.trim().length < 20} aria-label="사건 분석 시작"><Icon name="arrow" size={20} /></button>
          </div>
        </form>
        <div className="entry-foot"><span>20자 이상 · 최대 20,000자</span><span>Ctrl + Enter</span></div>
        {error && <p className="error" role="alert">{error}</p>}
        {saved && <button className="resume" onClick={onRestore}><Icon name="clock" size={14} /> 저장한 사건 이어보기 <Icon name="arrow" size={14} /></button>}

        <section className="samples" aria-label="예시 사건">
          <div className="samples-head"><span className="eyebrow">예시 사건으로 둘러보기</span><small>합성 사례 · API 호출 없음</small></div>
          <div className="sample-grid">
            {SAMPLES.map((s, i) => (
              <button type="button" key={s.id} className="sample-card" onClick={() => onSample(i)}>
                <span className="sample-index">0{i + 1}</span>
                <b>{s.label}</b>
                <small>{s.caption}</small>
                <span className="sample-go">열어보기 <Icon name="arrow" size={13} /></span>
              </button>
            ))}
          </div>
        </section>

        <ol className="value-strip">
          {STEPS.map(s => <li key={s.n}><span>{s.n}</span><div><b>{s.title}</b><p>{s.text}</p></div></li>)}
        </ol>
      </div>
      <p className="landing-footer">진단과 서류 준비까지 돕습니다. 발송과 접수는 직접 결정하세요.</p>
      <input type="file" accept=".txt,text/plain" hidden ref={upload} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </main>
  );
}
