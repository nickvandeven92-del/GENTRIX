import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";

export type SiteGenerationTransportMode = "jobs" | "stream";

/**
 * Studio gebruikt **altijd** server-jobs + polling (stabiel op Vercel). Browser-NDJSON-stream is verwijderd.
 * Route blijft bestaan voor compatibiliteit; `mode` is altijd `jobs`. Oude env-vars worden genegeerd.
 */
export function resolveSiteGenerationTransportMode(): SiteGenerationTransportMode {
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
