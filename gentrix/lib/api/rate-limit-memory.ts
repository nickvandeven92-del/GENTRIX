/**
 * Generic in-memory rate limiter (per server-instance).
 *
 * LET OP:
 *   Op Vercel/serverless bestaan meerdere instances naast elkaar; de effectieve limiet is dan
 *   `maxPerWindow × aantal instances`. Voor kritieke paden (auth, mail) is dit een zachte rem,
 *   geen harde garantie — schakel in productie naar Upstash Ratelimit of Vercel KV voor een
 *   centrale store. Totdat dat er is biedt dit bescherming tegen triviaal misbruik zonder
 *   externe afhankelijkheid.
 */

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_KEYS = 20_000;

/** Periodieke cleanup zodat het geheugen niet onbeperkt groeit. */
function sweepIfNeeded(now: number): void {
  if (store.size < MAX_KEYS) return;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
  if (store.size < MAX_KEYS) return;
  // Hard cap: verwijder oudste ~10% om geheugendruk te voorkomen.
  const toDelete = Math.ceil(store.size * 0.1);
  let i = 0;
  for (const key of store.keys()) {
    if (i++ >= toDelete) break;
    store.delete(key);
  }
}

export function checkMemoryRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number = 60_000,
): boolean {
  const now = Date.now();
  sweepIfNeeded(now);
  let b = store.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 1, resetAt: now + windowMs };
    store.set(key, b);
    return true;
  }
  if (b.count >= maxPerWindow) return false;
  b.count += 1;
  return true;
}

/** Reset een bucket expliciet (bijv. na succesvolle verificatie). */
export function resetMemoryRateLimit(key: string): void {
  store.delete(key);
}
