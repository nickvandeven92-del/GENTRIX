import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { insertClientAppointment } from "@/lib/appointments/insert-client-appointment";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const postSchema = z
  .object({
    title: z.string().max(200).optional(),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    notes: z.string().max(2000).optional().nullable(),
    staff_id: z.string().uuid().optional().nullable(),
    booking_service_id: z.string().uuid().optional().nullable(),
    booker_name: z.string().max(120).optional().nullable(),
    booker_email: z.union([z.string().email().max(254), z.literal("")]).optional().nullable(),
    booker_wants_confirmation: z.boolean().optional(),
    booker_wants_reminder: z.boolean().optional(),
  })
  .refine(
    (data) => {
      const wants = Boolean(data.booker_wants_confirmation || data.booker_wants_reminder);
      const email = data.booker_email?.trim();
      return !wants || Boolean(email);
    },
    { message: "E-mail is verplicht voor bevestiging of herinnering naar de boeker.", path: ["booker_email"] },
  );

type RouteContext = { params: Promise<{ slug: string }> };

/** Eén duidelijke hint: Postgres meldt meestal één ontbrekende kolom tegelijk. */
function hintForMissingClientAppointmentsColumn(dbMessage: string): string {
  const msg = dbMessage.toLowerCase();
  if (msg.includes("booking_service_id")) {
    return "Migratie ontbreekt: kolom booking_service_id ontbreekt. Voer 20260408150000_client_booking_services.sql uit in Supabase (SQL Editor).";
  }
  if (msg.includes("staff_id")) {
    return "Migratie ontbreekt: kolom staff_id ontbreekt. Voer eerst 20260407140000_client_staff_and_shifts.sql, daarna 20260408130000_client_appointments_staff_id.sql.";
  }
  if (
    msg.includes("booker_name") ||
    msg.includes("booker_email") ||
    msg.includes("booker_wants_confirmation") ||
    msg.includes("booker_wants_reminder") ||
    msg.includes("reminder_sent_at")
  ) {
    return "Migratie ontbreekt: boeker-/herinneringskolommen ontbreken. Voer 20260406160000_client_appointments_booker.sql uit in Supabase.";
  }
  return "Migratie ontbreekt: er ontbreken kolommen op client_appointments. Voer in Supabase de migraties uit onder supabase/migrations/ (vaak eerst 20260406160000_client_appointments_booker.sql; voor medewerkers/behandelingen daarna de staff- en booking_services-bestanden). Tip: in de Supabase-log staat welke kolom ontbreekt.";
}

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:appts:get:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld voor deze klant." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_appointments")
      .select(
        "id, title, starts_at, ends_at, status, notes, staff_id, booking_service_id, booker_name, booker_email, booker_wants_confirmation, booker_wants_reminder, reminder_sent_at, created_at, updated_at",
      )
      .eq("client_id", resolved.clientId)
      .order("starts_at", { ascending: true });

    if (error) {
      // Kolomfouten bevatten vaak "client_appointments" in de tekst; eerst afhandelen vóór de tabel-check.
      if (/column .* does not exist/i.test(error.message)) {
        return NextResponse.json(
          { ok: false, error: hintForMissingClientAppointmentsColumn(error.message) },
          { status: 503 },
        );
      }
      if (error.message.includes("client_appointments") || error.code === "42P01") {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260406143000_client_appointments.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, appointments: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:appts:post:${slug}`, 40)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld voor deze klant." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(parsed.data.ends_at);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return NextResponse.json({ ok: false, error: "Ongeldige datum/tijd." }, { status: 400 });
  }
  if (ends <= starts) {
    return NextResponse.json({ ok: false, error: "Einde moet na start zijn." }, { status: 400 });
  }

  const title = parsed.data.title?.trim() || "Afspraak";
  const bookerEmail = parsed.data.booker_email?.trim() || null;
  const bookerWantsConfirmation = Boolean(parsed.data.booker_wants_confirmation);
  const bookerWantsReminder = Boolean(parsed.data.booker_wants_reminder);
  const staffIdRaw = parsed.data.staff_id?.trim() || null;

  const supabase = createServiceRoleClient();

  if (staffIdRaw) {
    const chk = await supabase
      .from("client_staff")
      .select("id")
      .eq("client_id", resolved.clientId)
      .eq("id", staffIdRaw)
      .eq("is_active", true)
      .maybeSingle();
    if (chk.error || !chk.data) {
      return NextResponse.json({ ok: false, error: "Ongeldige medewerker." }, { status: 400 });
    }
  }

  const bookingServiceIdRaw = parsed.data.booking_service_id?.trim() || null;
  if (bookingServiceIdRaw) {
    const chkSvc = await supabase
      .from("client_booking_services")
      .select("id")
      .eq("client_id", resolved.clientId)
      .eq("id", bookingServiceIdRaw)
      .eq("is_active", true)
      .maybeSingle();
    if (chkSvc.error || !chkSvc.data) {
      return NextResponse.json({ ok: false, error: "Ongeldige of inactieve behandeling." }, { status: 400 });
    }
  }

  try {
    const inserted = await insertClientAppointment({
      clientId: resolved.clientId,
      clientName: resolved.name,
      title,
      startsAt: starts,
      endsAt: ends,
      notes: parsed.data.notes?.trim() || null,
      staffId: staffIdRaw,
      bookingServiceId: bookingServiceIdRaw,
      bookerName: parsed.data.booker_name?.trim() || null,
      bookerEmail,
      bookerWantsConfirmation,
      bookerWantsReminder,
    });

    if (!inserted.ok) {
      if (inserted.error.includes("booker_") || inserted.error.includes("reminder_sent")) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260406160000_client_appointments_booker.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: inserted.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, appointment: inserted.appointment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
