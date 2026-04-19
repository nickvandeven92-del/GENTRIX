import { headers } from "next/headers";
import { bookingVitePreflightResponse, jsonWithMaybeCors } from "@/lib/api/public-booking-cors";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string }> };

export async function OPTIONS(request: Request) {
  return bookingVitePreflightResponse(request);
}

async function requestClientIp(): Promise<string> {
  const h = await headers();
  const xf = h.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const ip = await requestClientIp();

  if (!checkPublicRateLimit(ip, `public:book-services:${slug}`, 60)) {
    return jsonWithMaybeCors(request, { ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return jsonWithMaybeCors(request, { ok: false, error: "Niet gevonden." }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return jsonWithMaybeCors(request, { ok: false, error: "Online boeken staat niet aan." }, { status: 403 });
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
        return jsonWithMaybeCors(request, { ok: true, services: [] });
      }
      return jsonWithMaybeCors(request, { ok: false, error: error.message }, { status: 500 });
    }

    return jsonWithMaybeCors(request, { ok: true, services: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return jsonWithMaybeCors(request, { ok: false, error: message }, { status: 503 });
  }
}
