import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PER_KEY_LIMIT, PER_KEY_WINDOW_MS, checkRateLimit, clientKey, resetRateLimits } from '../lib/ratelimit';

test('per-ip bucket allows the limit then blocks until the window resets', () => {
  resetRateLimits();
  const t0 = 1_000_000;
  for (let i = 0; i < PER_KEY_LIMIT; i++) assert.equal(checkRateLimit('1.1.1.1', t0).ok, true);
  const blocked = checkRateLimit('1.1.1.1', t0 + 1000);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.scope, 'ip');
  assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= PER_KEY_WINDOW_MS / 1000);
  assert.equal(checkRateLimit('2.2.2.2', t0).ok, true, 'other ip unaffected');
  assert.equal(checkRateLimit('1.1.1.1', t0 + PER_KEY_WINDOW_MS + 1).ok, true, 'window reset');
});

test('client key prefers the first forwarded address', () => {
  assert.equal(clientKey(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' })), '9.9.9.9');
  assert.equal(clientKey(new Headers({ 'x-real-ip': '8.8.8.8' })), '8.8.8.8');
  assert.equal(clientKey(new Headers()), 'unknown');
});
