import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { insertClientAppointment } from "@/lib/appointments/insert-client-appointment";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { getBookingDayBoundsMs } from "@/lib/booking/compute-booking-slots";
import { loadBookingSettingsForClientId } from "@/lib/booking/load-client-booking-settings";
import {
  clientHasActiveBookingServices,
  resolveActiveBookingService,
} from "@/lib/booking/booking-services-db";
import { listActiveClientStaffIds } from "@/lib/booking/list-active-client-staff";
import { isValidPublicBookedSlot } from "@/lib/booking/validate-public-booking-request";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { TZDate } from "@date-fns/tz";

const publicPostSchema = z.object({
  title: z.string().max(200).optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().min(1),
  notes: z.string().max(2000).optional().nullable(),
  /** Verplicht zodra de klant actieve medewerkers heeft (per-persoon boeken). */
  staff_id: z.string().uuid().optional().nullable(),
  /** Verplicht zodra de klant minstens één actieve behandeling heeft. */
  booking_service_id: z.string().uuid().optional().nullable(),
  booker_name: z.string().max(120).optional().nullable(),
  booker_email: z.string().email().max(254),
  booker_wants_confirmation: z.boolean().optional(),
  booker_wants_reminder: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ slug: string }> };

async function requestClientIp(): Promise<string> {
  const h = await headers();
  const xf = h.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const ip = await requestClientIp();

  if (!checkPublicRateLimit(ip, `public:appts:${slug}`, 20)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer later opnieuw." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: "Niet gevonden." }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Online boeken staat niet aan." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = publicPostSchema.safeParse(json);
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

  const slackMs = 60_000;
  const nowMs = Date.now();
  if (starts.getTime() < nowMs - slackMs) {
    return NextResponse.json({ ok: false, error: "Kies een starttijd in de toekomst." }, { status: 400 });
  }

  const settings = await loadBookingSettingsForClientId(resolved.clientId);
  const activeStaffIds = await listActiveClientStaffIds(resolved.clientId);
  const staffIdRaw = parsed.data.staff_id?.trim() || null;
  const needsBookingService = await clientHasActiveBookingServices(resolved.clientId);
  const bookingServiceRaw = parsed.data.booking_service_id?.trim() || null;
  let resolvedService: Awaited<ReturnType<typeof resolveActiveBookingService>> = null;

  if (needsBookingService) {
    if (!bookingServiceRaw) {
      return NextResponse.json(
        { ok: false, error: "Kies een behandeling en probeer opnieuw." },
        { status: 400 },
      );
    }
    resolvedService = await resolveActiveBookingService(resolved.clientId, bookingServiceRaw);
    if (!resolvedService) {
      return NextResponse.json(
        { ok: false, error: "Ongeldige of inactieve behandeling." },
        { status: 400 },
      );
    }
    const expectedMs = resolvedService.duration_minutes * 60 * 1000;
    const actualMs = ends.getTime() - starts.getTime();
    if (Math.abs(actualMs - expectedMs) > 90_000) {
      return NextResponse.json(
        { ok: false, error: "De gekozen tijden komen niet overeen met de duur van de behandeling." },
        { status: 400 },
      );
    }
  } else if (bookingServiceRaw) {
    return NextResponse.json(
      { ok: false, error: "Behandeling is voor deze zaak niet van toepassing." },
      { status: 400 },
    );
  }

  if (activeStaffIds.length > 0) {
    if (!staffIdRaw || !activeStaffIds.includes(staffIdRaw)) {
      return NextResponse.json(
        { ok: false, error: "Kies een geldige medewerker en probeer opnieuw." },
        { status: 400 },
      );
    }
  } else if (staffIdRaw) {
    return NextResponse.json({ ok: false, error: "Medewerker is voor deze zaak niet van toepassing." }, { status: 400 });
  }

  const dateYmd = (() => {
    const z = new TZDate(starts.getTime(), settings.timeZone);
    const y = z.getFullYear();
    const m = String(z.getMonth() + 1).padStart(2, "0");
    const d = String(z.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const bounds = getBookingDayBoundsMs(dateYmd, settings.timeZone);
  if (!bounds) {
    return NextResponse.json({ ok: false, error: "Ongeldige boekingstijd." }, { status: 400 });
  }

  const slotOk = await isValidPublicBookedSlot(
    resolved.clientId,
    settings,
    starts,
    ends,
    nowMs,
    activeStaffIds.length > 0 ? staffIdRaw : null,
    resolvedService?.duration_minutes,
  );
  if (!slotOk) {
    return NextResponse.json(
      { ok: false, error: "Dit tijdslot is niet beschikbaar. Vernieuw de pagina en kies een ander slot." },
      { status: 409 },
    );
  }

  const title = parsed.data.title?.trim() || resolvedService?.name || "Afspraak";
  const bookerEmail = parsed.data.booker_email.trim();
  const bookerWantsConfirmation = Boolean(parsed.data.booker_wants_confirmation);
  const bookerWantsReminder = Boolean(parsed.data.booker_wants_reminder);

  const inserted = await insertClientAppointment({
    clientId: resolved.clientId,
    clientName: resolved.name,
    title,
    startsAt: starts,
    endsAt: ends,
    notes: parsed.data.notes?.trim() || null,
    staffId: activeStaffIds.length > 0 ? staffIdRaw : null,
    bookingServiceId: needsBookingService ? bookingServiceRaw : null,
    bookerName: parsed.data.booker_name?.trim() || null,
    bookerEmail,
    bookerWantsConfirmation,
    bookerWantsReminder,
  });

  if (!inserted.ok) {
    if (inserted.error.includes("booker_") || inserted.error.includes("reminder_sent")) {
      return NextResponse.json({ ok: false, error: "Boeking tijdelijk niet beschikbaar." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: inserted.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, appointment: inserted.appointment });
}
