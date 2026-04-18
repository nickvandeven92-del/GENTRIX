/**
 * Time budget (seconds) for site-generation on Vercel serverless.
 * Route handlers must use a **numeric literal** met dezelfde waarde (Next.js 16 static analysis);
 * houd in sync:
 * - `app/api/generate-site/jobs/route.ts`
 * - `app/api/generate-site/jobs/[id]/route.ts`
 * - `app/api/generate-site/stream/route.ts`
 * - `app/api/generate-site/jobs/[id]/continue/route.ts` (fase 2)
 * - `app/api/generate-site/route.ts`
 *
 * **800 s** = Vercel Pro/Enterprise (fluid) maximum; zet Vercel-project op Pro.
 * **Hobby** omsluiting = max. **300 s** — `maxDuration` boven 300 laat de deploy dáár vaak fallen.
 * Voor gratis tier: `SITE_GENERATION_JOB_MAX_DURATION_SEC` + alle route-literals tóch **300** houden.
 */
export const SITE_GENERATION_JOB_MAX_DURATION_SEC = 800;

export const SITE_GENERATION_JOB_MAX_DURATION_MS = SITE_GENERATION_JOB_MAX_DURATION_SEC * 1_000;

/**
 * Extra window for the browser to treat a stuck `running` job as dead after the platform limit
 * (keepalives refresh `updated_at`, so the client must not rely on that alone).
 */
export const SITE_GENERATION_JOB_CLIENT_WALL_GRACE_MS = 120_000;
