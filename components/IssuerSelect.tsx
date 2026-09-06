'use client';

import { ISSUERS } from '@/lib/knowledge';

export function IssuerSelect({ value, onChange, compact }: { value: string; onChange: (id: string) => void; compact?: boolean }) {
  return (
    <select className={`issuer-select ${compact ? 'compact' : ''}`} value={value} onChange={e => onChange(e.target.value)} aria-label="카드사 선택">
      <option value="">카드사 선택</option>
      {ISSUERS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
    </select>
  );
}
