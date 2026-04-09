/**
 * Publieke endpoints: per IP + scope, in-memory (zelfde beperking als portal-rate-limit).
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function checkPublicRateLimit(ip: string, scope: string, maxPerWindow: number): boolean {
  const key = `${ip}:${scope}`;
  const now = Date.now();
  let b = store.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    store.set(key, b);
  }
  if (b.count >= maxPerWindow) return false;
  b.count += 1;
  return true;
}
