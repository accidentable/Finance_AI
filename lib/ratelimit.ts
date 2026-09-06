// 공개 URL 보호용 간단한 호출 제한. 인스턴스 메모리에만 기록하므로 완전한 방어가 아니라 남용을 늦추는 장치다.
type Bucket = { count: number; reset: number };

const perKey = new Map<string, Bucket>();
const global: Bucket = { count: 0, reset: 0 };

export const PER_KEY_LIMIT = Number(process.env.RATE_LIMIT_PER_IP || 8);
export const PER_KEY_WINDOW_MS = 10 * 60_000;
export const GLOBAL_LIMIT = Number(process.env.RATE_LIMIT_GLOBAL || 240);
export const GLOBAL_WINDOW_MS = 60 * 60_000;

function take(bucket: Bucket, limit: number, windowMs: number, now: number): { ok: boolean; retryAfter: number } {
  if (now >= bucket.reset) { bucket.count = 0; bucket.reset = now + windowMs; }
  if (bucket.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function checkRateLimit(key: string, now = Date.now()): { ok: boolean; retryAfter: number; scope?: 'ip' | 'global' } {
  if (perKey.size > 5000) for (const [k, b] of perKey) if (now >= b.reset) perKey.delete(k);
  const bucket = perKey.get(key) ?? { count: 0, reset: 0 };
  perKey.set(key, bucket);
  const mine = take(bucket, PER_KEY_LIMIT, PER_KEY_WINDOW_MS, now);
  if (!mine.ok) return { ...mine, scope: 'ip' };
  const all = take(global, GLOBAL_LIMIT, GLOBAL_WINDOW_MS, now);
  if (!all.ok) { bucket.count -= 1; return { ...all, scope: 'global' }; }
  return { ok: true, retryAfter: 0 };
}

export function clientKey(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : headers.get('x-real-ip') || 'unknown').trim();
  return ip || 'unknown';
}

export function resetRateLimits() {
  perKey.clear();
  global.count = 0; global.reset = 0;
}
