import { createHash } from "node:crypto";

/** Ruwe IP uitsluitend voor rate limiting; wordt nooit in `site_analytics_events` opgeslagen. */
export function getRequestIpForRateLimit(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

const UA_HASH_PREFIX = "sha256:";

/** Geen volledige user-agent in DB; alleen korte hash (Minder koppelbaar, AVG-vriendiger). */
export function hashUserAgentForStorage(ua: string | null): string | null {
  if (ua == null) return null;
  const t = String(ua).trim();
  if (t.length === 0) return null;
  const h = createHash("sha256").update(t, "utf8").digest("hex");
  return `${UA_HASH_PREFIX}${h.slice(0, 32)}`;
}

const REF_MAX = 500;

export function refererForStorage(referer: string | null): string | null {
  if (referer == null) return null;
  const t = String(referer).trim();
  if (t.length === 0) return null;
  if (t.length <= REF_MAX) return t;
  const h = createHash("sha256").update(t, "utf8").digest("hex");
  return `sha256ref:${h.slice(0, 32)}`;
}

export const ANALYTICS_PROPERTIES_MAX_BYTES = 6 * 1024;

/**
 * Geserialiseerde JSON van `properties` ≤ maxBytes; knipt langere stringvelden.
 */
export function capEventPropertiesSize(
  props: Record<string, string | number | boolean>,
  maxBytes: number = ANALYTICS_PROPERTIES_MAX_BYTES,
): Record<string, string | number | boolean> {
  const clone: Record<string, string | number | boolean> = { ...props };
  for (let i = 0; i < 32; i++) {
    if (JSON.stringify(clone).length <= maxBytes) return clone;
    const keys = Object.keys(clone).filter((k) => typeof clone[k] === "string");
    if (keys.length === 0) {
      return { tr: 1 };
    }
    const strKeys = keys as string[];
    strKeys.sort(
      (a, b) => String((clone as Record<string, string>)[b] ?? "").length - String((clone as Record<string, string>)[a] ?? "").length,
    );
    const k0 = strKeys[0]!;
    const v = String((clone as Record<string, string>)[k0] ?? "");
    (clone as Record<string, string>)[k0] = v.length > 8 ? v.slice(0, Math.max(4, v.length - 32)) : "";
  }
  return JSON.stringify(clone).length <= maxBytes ? clone : { tr: 1 };
}

type Bucket = { t: number; c: number };

const buckets = new Map<string, Bucket>();
const BUCKET_SWEEP_EVERY = 10_000;
let lastSweep = 0;

function sweepIfNeeded() {
  const now = Date.now();
  if (now - lastSweep < BUCKET_SWEEP_EVERY) return;
  lastSweep = now;
  for (const [k, b] of buckets) {
    if (now - b.t > 600_000) buckets.delete(k);
  }
}

/**
 * In-memory: requests per IP per window (soft limit op multi-instance / serverless).
 * Productie: zet Vercel firewall / edge of Redis; env hier tunen.
 */
export function isAnalyticsIngestOverRateLimit(
  key: string,
  maxInWindow: number,
  windowMs: number,
): boolean {
  sweepIfNeeded();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) {
    buckets.set(key, { t: now, c: 1 });
    return false;
  }
  if (now - b.t > windowMs) {
    b.t = now;
    b.c = 1;
    return false;
  }
  b.c += 1;
  return b.c > maxInWindow;
}

export function analyticsIngestMaxRequestsPerWindow(): number {
  const raw = process.env.ANALYTICS_INGEST_MAX_REQUESTS_PER_IP_WINDOW;
  const n = raw != null && raw !== "" ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n > 0) return Math.min(10_000, n);
  return 120;
}

export function analyticsIngestWindowMs(): number {
  const raw = process.env.ANALYTICS_INGEST_WINDOW_MS;
  const n = raw != null && raw !== "" ? Number.parseInt(String(raw), 10) : NaN;
  if (Number.isFinite(n) && n >= 10_000) return Math.min(3_600_000, n);
  return 600_000;
}
