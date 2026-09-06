import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REASON_CODES, autoChecked, buildPlan, evidenceFor, issuerForm, lookupMerchant, readiness, referenceDeadline, sellerFromDescriptor } from '../lib/playbook';
import { SAMPLES } from '../lib/samples';

test('descriptor lookup decodes processors and known merchants without false positives', () => {
  assert.equal(lookupMerchant('STRIPE *GAMMAAI', null)?.id, 'stripe');
  assert.equal(sellerFromDescriptor('STRIPE *GAMMAAI'), 'GAMMAAI');
  assert.equal(lookupMerchant('OPENAI *CHATGPT SUBSCR', null)?.id, 'openai');
  assert.equal(lookupMerchant('AMZN WEB SERVICES', null)?.id, 'aws');
  assert.equal(lookupMerchant(null, 'Google Cloud')?.id, 'google');
  assert.equal(lookupMerchant('ALPHAWRITE', 'AlphaWrite'), null);
});

test('credential theft never maps to a card-fraud reason code', () => {
  const m = REASON_CODES.credential_theft!;
  assert.equal(m.visa.code, '보류');
  assert.match(m.summary, /10\.4/);
  assert.equal(REASON_CODES.cancelled_recurring!.visa.code, '13.2');
  assert.equal(REASON_CODES.duplicate!.mastercard.code, '4834');
  assert.equal(REASON_CODES.unknown, null);
});

test('reference deadline is transaction date plus 120 days and never invents a date', () => {
  assert.equal(referenceDeadline(null), null);
  assert.equal(referenceDeadline('2026-9-1'), null);
  const ref = referenceDeadline('2026-09-01', new Date(2026, 8, 6));
  assert.deepEqual(ref, { due: '2026-12-30', daysLeft: 115 });
  assert.equal(referenceDeadline('2026-01-01', new Date(2026, 8, 6))!.daysLeft < 0, true);
});

test('plan adapts to case type and payment status', () => {
  for (const s of SAMPLES) {
    const merchant = lookupMerchant(s.result.parsed.descriptor, s.result.parsed.merchant);
    const plan = buildPlan(s.result.parsed, merchant, s.result.report.actions);
    assert.equal(plan.length, 3);
    const ids = plan.flatMap(p => p.steps.map(st => `${p.id}:${st.id}`));
    assert.equal(new Set(ids).size, ids.length, 'step ids are unique');
    assert.equal(plan.flatMap(p => p.steps).filter(st => st.source === 'ai').length, s.result.report.actions.length);
  }
  const theft = SAMPLES.find(s => s.id === 'apikey')!;
  const plan = buildPlan(theft.result.parsed, lookupMerchant(theft.result.parsed.descriptor, null));
  assert.ok(plan[0].steps.some(st => st.id === 'rotate'));
  assert.ok(plan[2].steps.some(st => st.id === 'issuer_block'), 'declined case prepares blocking, not filing');
  const sub = SAMPLES.find(s => s.id === 'subscription')!;
  assert.ok(buildPlan(sub.result.parsed, null)[2].steps.some(st => st.id === 'file'), 'posted case prepares filing');
});

test('evidence auto-check reads user facts and readiness counts only listed items', () => {
  const sub = SAMPLES.find(s => s.id === 'subscription')!;
  const checks = autoChecked(sub.result.parsed);
  assert.equal(checks.cancel_request, true);
  assert.equal(checks.transaction, true);
  assert.equal(checks.cancel_confirm, false);
  const items = evidenceFor('cancelled_recurring');
  const r = readiness(items, checks);
  assert.equal(r.total, items.length);
  assert.ok(r.done >= 2 && r.done < r.total);
});

test('issuer form keeps placeholders for anything the user must confirm', () => {
  const theft = SAMPLES.find(s => s.id === 'apikey')!;
  const form = issuerForm(theft.result.parsed, lookupMerchant(theft.result.parsed.descriptor, null), REASON_CODES.credential_theft, theft.result.report.drafts.timeline);
  const get = (label: string) => form.find(f => f.label === label)!.value;
  assert.equal(get('신청인'), '[직접 입력]');
  assert.equal(get('실제 사업자'), 'GAMMAAI');
  assert.equal(get('거래일'), '2026-09-04');
  assert.match(get('분쟁 사유 (후보)'), /보류/);
});
