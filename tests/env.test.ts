import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL, cleanEnv, resolveModel } from '../lib/agent';

test('env values lose stray newlines, quotes and whitespace', () => {
  assert.equal(cleanEnv('gpt-5.6-sol\ngpt-5.6-sol'), 'gpt-5.6-sol');
  assert.equal(cleanEnv('  "gpt-5.6-sol"  \r\n'), 'gpt-5.6-sol');
  assert.equal(cleanEnv(undefined), '');
  const before = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = '\n';
  assert.equal(resolveModel(), DEFAULT_MODEL);
  process.env.OPENAI_MODEL = 'gpt-5.6-terra\n';
  assert.equal(resolveModel(), 'gpt-5.6-terra');
  if (before === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = before;
});
