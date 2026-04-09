import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string }> };

async function requestClientIp(): Promise<string> {
  const h = await headers();
  const xf = h.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const ip = await requestClientIp();

  if (!checkPublicRateLimit(ip, `public:book-services:${slug}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Online boeken staat niet aan." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_booking_services")
      .select("id, name, description, duration_minutes, price_cents, sort_order")
      .eq("client_id", resolved.clientId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      if (error.message.includes("client_booking_services") || error.code === "42P01") {
        return NextResponse.json({ ok: true, services: [] });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, services: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
