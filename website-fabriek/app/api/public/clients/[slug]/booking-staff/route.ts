import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolvePublicBookingSlotDurationMinutes } from "@/lib/booking/booking-services-db";
import { computePublicBookingSlotsForDay } from "@/lib/booking/compute-public-booking-slots-for-day";
import { parseYmd } from "@/lib/booking/compute-booking-slots";
import { loadBookingSettingsForClientId } from "@/lib/booking/load-client-booking-settings";
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

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const ip = await requestClientIp();

  if (!checkPublicRateLimit(ip, `public:book-staff:${slug}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Online boeken staat niet aan." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim() ?? "";
  const serviceParam = searchParams.get("service")?.trim() ?? "";
  if (!dateParam || !parseYmd(dateParam)) {
    return NextResponse.json({ ok: false, error: "Parameter date (YYYY-MM-DD) is verplicht." }, { status: 400 });
  }

  const durRes = await resolvePublicBookingSlotDurationMinutes(resolved.clientId, serviceParam);
  if (!durRes.ok) {
    return NextResponse.json({ ok: false, error: durRes.error }, { status: durRes.status });
  }

  const settings = await loadBookingSettingsForClientId(resolved.clientId);
  const nowMs = Date.now();

  const supabase = createServiceRoleClient();
  const { data: members, error } = await supabase
    .from("client_staff")
    .select("id, name, sort_order")
    .eq("client_id", resolved.clientId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error?.message?.includes("client_staff") || error?.code === "42P01") {
    return NextResponse.json({ ok: true, requiresStaffSelection: false, staff: [] });
  }
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!members?.length) {
    return NextResponse.json({ ok: true, requiresStaffSelection: false, staff: [] });
  }

  const staffOut: { id: string; name: string }[] = [];
  for (const m of members) {
    const slots = await computePublicBookingSlotsForDay({
      clientId: resolved.clientId,
      settings,
      dateYmd: dateParam,
      nowMs,
      staffId: m.id as string,
      slotDurationMinutes: durRes.slotDurationMinutes,
    });
    if (slots.length > 0) {
      staffOut.push({ id: m.id as string, name: String(m.name) });
    }
  }

  return NextResponse.json({ ok: true, requiresStaffSelection: true, staff: staffOut });
}
