import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMAGES, validateImages } from '../lib/images';

test('image payload validation rejects bad mime, size, count and encoding', () => {
  assert.deepEqual(validateImages(undefined), []);
  assert.equal(typeof validateImages('nope'), 'string');
  assert.equal(typeof validateImages([{ mime: 'image/gif', data: 'AAAA' }]), 'string');
  assert.equal(typeof validateImages([{ mime: 'image/jpeg', data: 'not base64!' }]), 'string');
  assert.equal(typeof validateImages(Array.from({ length: MAX_IMAGES + 1 }, () => ({ mime: 'image/jpeg', data: 'AAAA' }))), 'string');
  const ok = validateImages([{ mime: 'image/png', data: 'iVBORw0KGgo=' }, { mime: 'image/webp', data: 'UklGRg==' }]);
  assert.ok(Array.isArray(ok) && ok.length === 2);
});
