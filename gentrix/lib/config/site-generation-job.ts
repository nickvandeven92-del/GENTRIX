/**
 * Time budget (seconds) for site-generation on Vercel serverless.
 * Keep in sync with `export const maxDuration` on:
 * - `app/api/generate-site/jobs/route.ts`
 * - `app/api/generate-site/jobs/[id]/route.ts`
 * - `app/api/generate-site/stream/route.ts`
 * - `app/api/generate-site/route.ts`
 *
 * Hobby: max 300. On Pro you may raise route `maxDuration` and this constant together.
 */
export const SITE_GENERATION_JOB_MAX_DURATION_SEC = 300;

export const SITE_GENERATION_JOB_MAX_DURATION_MS = SITE_GENERATION_JOB_MAX_DURATION_SEC * 1_000;

/**
 * Extra window for the browser to treat a stuck `running` job as dead after the platform limit
 * (keepalives refresh `updated_at`, so the client must not rely on that alone).
 */
export const SITE_GENERATION_JOB_CLIENT_WALL_GRACE_MS = 120_000;
