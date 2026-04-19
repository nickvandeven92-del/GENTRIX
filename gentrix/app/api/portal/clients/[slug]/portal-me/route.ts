import { NextResponse } from "next/server";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";

type RouteContext = { params: Promise<{ slug: string }> };

/**
 * Lichte bootstrap voor embedded owner-UI (Vite booking-app): naam + id na sessiecheck.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:me:get:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    clientId: resolved.clientId,
    name: resolved.name,
    slug,
    appointmentsEnabled: resolved.appointmentsEnabled,
  });
}
