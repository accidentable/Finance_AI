import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combineSlots, EMPTY_SLOTS, guardParsed } from '../lib/case';
import { SAMPLES } from '../lib/samples';

test('combineSlots labels only the filled slots and keeps text verbatim', () => {
  assert.equal(combineSlots(EMPTY_SLOTS), '');
  const out = combineSlots({ sms: '[Web발신] 해외승인 X USD 1.00', mail: '', note: '  설명  ' });
  assert.equal(out, '[카드 알림 문자 · 거래내역]\n[Web발신] 해외승인 X USD 1.00\n\n[내 상황 설명]\n설명');
});

test('sample slots reproduce every quoted fact and signal', () => {
  for (const s of SAMPLES) {
    assert.equal(s.text, combineSlots(s.slots));
    assert.ok(s.slots.sms.length > 0, `${s.id} has a card notification`);
    const guarded = guardParsed(s.result.parsed, s.text);
    assert.equal(guarded.facts.length, s.result.parsed.facts.length);
    assert.equal(guarded.signals.length, s.result.parsed.signals.length);
  }
});
