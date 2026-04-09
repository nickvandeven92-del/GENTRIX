/**
 * Eenvoudige per-user rate limit voor portal-API’s (in-memory; per server instance).
 * Basis bescherming tegen misbruik — in-memory per serverproces. Voor meerdere instances: later Redis/Upstash koppelen.
 */
type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function checkPortalRateLimit(userId: string, scope: string, maxPerWindow: number): boolean {
  const key = `${userId}:${scope}`;
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
