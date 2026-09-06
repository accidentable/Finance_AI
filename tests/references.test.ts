import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReferences, findReference } from '../lib/references';
import { ISSUERS } from '../lib/knowledge';
import { smsSection, combineSlots } from '../lib/case';
import { SAMPLES } from '../lib/samples';

test('every sample basis and action points at an existing reference', () => {
  for (const s of SAMPLES) {
    const ids = new Set(s.result.references.map(r => r.id));
    assert.equal(ids.size, s.result.references.length, `${s.id}: duplicate reference ids`);
    assert.ok(s.result.references.length >= 4, s.id);
    for (const b of s.result.report.basis) assert.ok(ids.has(b.refId), `${s.id}: basis ${b.refId}`);
    for (const a of s.result.report.actions) assert.ok(ids.has(a.sourceId), `${s.id}: action ${a.sourceId}`);
    for (const r of s.result.references) {
      assert.match(r.url, /^https?:\/\//, r.id);
      assert.match(r.accessed, /^\d{4}-\d{2}-\d{2}$/, r.id);
      assert.ok(r.text.length > 20 && r.text.length <= 700, r.id);
    }
  }
});

test('references adapt to case type, merchant and issuer', () => {
  const theft = SAMPLES.find(s => s.id === 'aws')!;
  const refs = buildReferences(theft.result.parsed, ISSUERS.find(i => i.id === 'kb')!);
  const fraud = findReference(refs, 'code:visa:10.4')!;
  assert.match(fraud.text, /해당 없음/);
  assert.ok(findReference(refs, 'merchant:aws'));
  assert.ok(findReference(refs, 'issuer:kb')?.text.includes('110일'));
  const sub = buildReferences(SAMPLES[0].result.parsed);
  assert.ok(findReference(sub, 'code:visa:12.5'));
  assert.ok(!findReference(sub, 'code:visa:10.4'));
  assert.ok(!sub.some(r => r.kind === 'issuer'));
});

test('smsSection returns only the card notification slot', () => {
  const text = combineSlots({ sms: '[Web발신] 해외승인 X USD 1.00 09/01 10:00', mail: 'From: a@b.c', note: '설명' });
  assert.equal(smsSection(text), '[Web발신] 해외승인 X USD 1.00 09/01 10:00');
  assert.equal(smsSection(combineSlots({ sms: '', mail: 'm', note: 'n' })), '');
  assert.equal(smsSection(combineSlots({ sms: 'only', mail: '', note: '' })), 'only');
});
