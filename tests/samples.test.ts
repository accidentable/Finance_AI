import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLES } from '../lib/samples';
import { ISSUERS, findIssuer } from '../lib/knowledge';

test('예시 사건마다 카드사가 미리 지정돼 있고 문자에서도 같은 카드사가 읽힌다', () => {
  for (const s of SAMPLES) {
    const issuer = ISSUERS.find(i => i.id === s.issuerId);
    assert.ok(issuer, `${s.id}: issuerId ${s.issuerId}`);
    assert.equal(findIssuer(s.slots.sms)?.id, s.issuerId, `${s.id}: 문자에서 카드사 인식`);
    assert.ok(s.result.references.some(r => r.kind === 'issuer'), `${s.id}: 카드사 근거 포함`);
  }
});
