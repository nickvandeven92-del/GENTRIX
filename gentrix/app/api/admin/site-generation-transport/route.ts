import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";

export type SiteGenerationTransportMode = "jobs" | "stream";

/**
 * Bepaalt **runtime** of de studio NDJSON-stream of server-jobs + polling gebruikt.
 *
 * `NEXT_PUBLIC_*` in clientbundles wordt bij **build** ingevuld — een wijziging in Vercel zonder rebuild
 * heeft dan geen effect. Daarom leest de client deze route bij elke generatie.
 *
 * Prioriteit:
 * 1. `SITE_GENERATION_TRANSPORT` = `stream` | `jobs` (server-only, aanbevolen op Vercel)
 * 2. `NEXT_PUBLIC_SITE_GENERATION_USE_STREAM` = `true`/`1` → stream (build-time + server runtime)
 * 3. default → `jobs`
 */
export function resolveSiteGenerationTransportMode(): SiteGenerationTransportMode {
  const server = process.env.SITE_GENERATION_TRANSPORT?.trim().toLowerCase();
  if (server === "stream" || server === "ndjson") return "stream";
  if (server === "jobs" || server === "poll") return "jobs";

  const legacy = process.env.NEXT_PUBLIC_SITE_GENERATION_USE_STREAM?.trim().toLowerCase();
  if (legacy === "true" || legacy === "1" || legacy === "yes" || legacy === "on") {
    return "stream";
  }
  return "jobs";
}

export async function GET() {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const mode = resolveSiteGenerationTransportMode();
  return NextResponse.json(
    { ok: true, mode },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
