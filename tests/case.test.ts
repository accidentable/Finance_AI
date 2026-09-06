import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParsedSchema, ReportSchema, deadlineFor, guardParsed, maskText } from '../lib/case';
import { verifySender, searchRules } from '../lib/rules';
import { SAMPLES } from '../lib/samples';

test('sensitive patterns are hidden while dates and amounts survive', () => {
  const input = '2026-09-01 USD 29.00 person@example.com 010-1234-5678 4111 1111 1111 1111 sk-proj-abcdefghijklmnopqrst https://example.com/bill?token=secret';
  const output = maskText(input);
  for (const secret of ['person@', '010-1234', '4111', 'abcdefghijklmnopqrst', 'token=secret']) assert.ok(!output.includes(secret));
  assert.ok(output.includes('2026-09-01 USD 29.00'));
  assert.equal(maskText(output), output);
});
test('domain match never authenticates sender or lookalike domains', () => {
  assert.equal(verifySender('openai.com.evil.example').label, '도메인 추가 확인');
  assert.equal(verifySender('mail.openai.com').label, '도메인 목록 일치');
  assert.match(verifySender('openai.com').note, /인증할 수 없/);
  assert.equal(verifySender(null).label, '발신 정보 부족');
});
test('no arbitrary deadline even for posted transactions; declined cases retain issuer help', () => {
  for (const status of ['posted', 'approved', 'declined', 'invoice_only', 'unknown'] as const) assert.equal(deadlineFor(status).status, 'unconfirmed');
  assert.match(deadlineFor('declined').note, /상담/);
});
test('untraceable evidence quotes are dropped', () => {
  const parsed = SAMPLES[0].result.parsed;
  const guarded = guardParsed({ ...parsed, facts: [...parsed.facts, { label: '허위', value: '환불됨', quote: 'refund complete' }] }, SAMPLES[0].text);
  assert.equal(guarded.facts.length, parsed.facts.length);
});
test('all three demo cases have valid schemas and source-backed connections', () => {
  for (const s of SAMPLES) {
    ParsedSchema.parse(s.result.parsed); ReportSchema.parse(s.result.report);
    assert.equal(s.result.mode, 'demo');
    assert.equal(guardParsed(s.result.parsed, s.text).facts.length, s.result.parsed.facts.length);
    for (const a of s.result.report.actions) assert.ok(searchRules(s.result.parsed.caseType).some(r => r.id === a.sourceId));
    assert.ok(s.result.report.routes.some(r => r.name === 'issuer'));
  }
});
