import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";

export type SiteGenerationTransportMode = "jobs" | "stream";

/**
 * Site-studio (`GeneratorForm`) gebruikt **NDJSON** (`POST /api/generate-site/stream`). Async jobs + DB blijven
 * beschikbaar voor achtergrond/scripts, maar de studio pollt niet meer.
 */
export function resolveSiteGenerationTransportMode(): SiteGenerationTransportMode {
  return "stream";
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
