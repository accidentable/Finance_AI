import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORITIES, ISSUERS, MERCHANT_POLICIES, REASON_CODE_LIST, findIssuer, findMerchantPolicy, parseNotification, reasonCodesFor, reconcileWithNotification } from '../lib/knowledge';
import patterns from '../data/notification-patterns.json';
import { CASE_TYPES } from '../lib/case';
import { SAMPLES } from '../lib/samples';

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
function checkSources(label: string, sources: { title: string; url: string; accessed: string; kind: string }[]) {
  assert.ok(sources.length > 0, `${label}: source required`);
  for (const s of sources) {
    assert.ok(s.title && /^https?:\/\//.test(s.url), `${label}: bad source ${JSON.stringify(s)}`);
    assert.match(s.accessed, isoDate, `${label}: accessed date`);
    assert.ok(['official', 'news', 'community', 'secondary'].includes(s.kind), `${label}: kind`);
  }
}

test('nine issuers with phone, at least one channel and sources', () => {
  assert.equal(ISSUERS.length, 9);
  for (const i of ISSUERS) {
    assert.ok(i.phone && i.channels.length > 0 && i.deadline, i.id);
    checkSources(i.id, i.sources);
  }
  assert.equal(findIssuer('KB국민카드 해외승인')?.id, 'kb');
  assert.equal(findIssuer('[Web발신] 신한카드 해외승인')?.id, 'shinhan');
  assert.equal(findIssuer('NH농협카드')?.id, 'nh');
  assert.equal(findIssuer('알 수 없음'), null);
});

test('reason codes reference valid case types and keep card-fraud codes away from key theft', () => {
  for (const c of REASON_CODE_LIST) {
    for (const t of c.caseTypes) assert.ok((CASE_TYPES as readonly string[]).includes(t), `${c.code}: ${t}`);
    assert.ok(c.timeLimit.length > 0 && c.koreanNote.length > 0, c.code);
  }
  assert.ok(reasonCodesFor('cancelled_recurring').some(c => c.code === '13.2'));
  assert.ok(reasonCodesFor('duplicate').some(c => c.code === '12.6.1'));
  assert.ok(!reasonCodesFor('credential_theft').some(c => c.code === '10.4' || c.code === '4837'));
});

test('merchant policies have descriptors, channels and sources; lookup matches samples', () => {
  assert.ok(MERCHANT_POLICIES.length >= 15);
  for (const m of MERCHANT_POLICIES) {
    assert.ok(m.descriptors.length > 0 && m.channels.length > 0 && m.refund && m.unauthorized, m.id);
    for (const ch of m.channels) assert.match(ch.url, /^https?:\/\//, `${m.id}: ${ch.label}`);
    checkSources(m.id, m.sources);
  }
  assert.equal(findMerchantPolicy('STRIPE *GAMMAAI', null)?.id, 'stripe');
  assert.equal(findMerchantPolicy('OPENAI *CHATGPT SUBSCR', null)?.id, 'openai');
  assert.equal(findMerchantPolicy(null, 'Anthropic')?.id, 'anthropic');
  assert.equal(findMerchantPolicy('ALPHAWRITE', 'AlphaWrite'), null);
});

test('authorities carry dated points with sources', () => {
  assert.ok(AUTHORITIES.length >= 5);
  for (const a of AUTHORITIES) { assert.ok(a.points.length > 0, a.id); checkSources(a.id, a.sources); }
});

test('notification patterns compile and parse the documented examples', () => {
  for (const [k, v] of Object.entries(patterns.patterns)) assert.doesNotThrow(() => new RegExp(v), k);
  for (const ex of patterns.examples) {
    const n = parseNotification(ex.text);
    assert.equal(n.type, ex.expected.type, ex.text);
    assert.equal(n.currency, ex.expected.currency);
    assert.equal(n.amount, ex.expected.amount);
    assert.equal(n.date, ex.expected.date);
    assert.equal(n.time, ex.expected.time);
    assert.equal(n.descriptor, ex.expected.descriptor);
    assert.equal(n.suspicious, false);
  }
  assert.equal(parseNotification('[국제발신] [이베이] 결제안내 518USD$ 완료').suspicious, true);
  for (const s of SAMPLES) {
    const n = parseNotification(s.slots.sms);
    assert.equal(n.descriptor, s.result.parsed.descriptor, s.id);
  }
});

test('reconcile fills descriptor and amount only when extraction left them empty', () => {
  const base = { ...SAMPLES[0].result.parsed, descriptor: null, amount: null, paymentStatus: 'unknown' as const };
  const fixed = reconcileWithNotification(base, SAMPLES[0].slots.sms);
  assert.equal(fixed.descriptor, 'ALPHAWRITE');
  assert.equal(fixed.amount, 'USD 29.00');
  assert.equal(fixed.paymentStatus, 'approved');
  const kept = reconcileWithNotification(SAMPLES[0].result.parsed, SAMPLES[0].slots.sms);
  assert.equal(kept.paymentStatus, 'posted');
});
