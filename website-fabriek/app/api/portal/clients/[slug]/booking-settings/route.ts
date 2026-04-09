import { NextResponse } from "next/server";
import { bookingSettingsSchema, type BookingSettings } from "@/lib/booking/booking-settings";
import { loadBookingSettingsForClientId } from "@/lib/booking/load-client-booking-settings";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:bookset:get:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld." }, { status: 403 });
  }

  const settings = await loadBookingSettingsForClientId(resolved.clientId);
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:bookset:patch:${slug}`, 40)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bookingSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const settings: BookingSettings = parsed.data;

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("clients")
      .update({ booking_settings: settings })
      .eq("id", resolved.clientId);

    if (error) {
      if (isPostgrestUnknownColumnError(error, "booking_settings")) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260407120000_clients_booking_settings.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
