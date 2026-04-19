import { headers } from "next/headers";
import { bookingVitePreflightResponse, jsonWithMaybeCors } from "@/lib/api/public-booking-cors";
import { getBookingCalendarMeta } from "@/lib/booking/booking-calendar-meta";
import { computePublicBookingSlotsForDay } from "@/lib/booking/compute-public-booking-slots-for-day";
import { getBookingDayBoundsMs, parseYmd } from "@/lib/booking/compute-booking-slots";
import { resolvePublicBookingSlotDurationMinutes } from "@/lib/booking/booking-services-db";
import { listActiveClientStaffIds } from "@/lib/booking/list-active-client-staff";
import { loadBookingSettingsForClientId } from "@/lib/booking/load-client-booking-settings";
import { checkPublicRateLimit } from "@/lib/api/public-rate-limit";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";

type RouteContext = { params: Promise<{ slug: string }> };

async function requestClientIp(): Promise<string> {
  const h = await headers();
  const xf = h.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function OPTIONS(request: Request) {
  return bookingVitePreflightResponse(request);
}

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const ip = await requestClientIp();

  if (!checkPublicRateLimit(ip, `public:book-slots:${slug}`, 60)) {
    return jsonWithMaybeCors(request, { ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return jsonWithMaybeCors(request, { ok: false, error: "Niet gevonden." }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return jsonWithMaybeCors(request, { ok: false, error: "Online boeken staat niet aan." }, { status: 403 });
  }

  const settings = await loadBookingSettingsForClientId(resolved.clientId);
  const nowMs = Date.now();
  const meta = getBookingCalendarMeta(settings, nowMs);

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date")?.trim() ?? "";
  const staffParam = searchParams.get("staff")?.trim() ?? "";
  const serviceParam = searchParams.get("service")?.trim() ?? "";

  if (!dateParam) {
    return jsonWithMaybeCors(request, { ok: true, meta, slots: [], businessName: resolved.name });
  }

  if (!parseYmd(dateParam)) {
    return jsonWithMaybeCors(request, { ok: false, error: "Ongeldige datum (gebruik YYYY-MM-DD)." }, { status: 400 });
  }

  const bounds = getBookingDayBoundsMs(dateParam, settings.timeZone);
  if (!bounds) {
    return jsonWithMaybeCors(request, { ok: false, error: "Ongeldige datum." }, { status: 400 });
  }

  const activeStaffIds = await listActiveClientStaffIds(resolved.clientId);
  let staffId: string | null = null;

  if (activeStaffIds.length > 0) {
    if (!staffParam || !UUID_RE.test(staffParam)) {
      return jsonWithMaybeCors(request,
        { ok: false, error: "Kies een medewerker om tijden te zien (parameter staff ontbreekt of is ongeldig)." },
        { status: 400 },
      );
    }
    if (!activeStaffIds.includes(staffParam)) {
      return jsonWithMaybeCors(request, { ok: true, meta, slots: [], businessName: resolved.name });
    }
    staffId = staffParam;
  } else if (staffParam) {
    return jsonWithMaybeCors(request, { ok: false, error: "Deze zaak gebruikt geen medewerkerskeuze." }, { status: 400 });
  }

  const durRes = await resolvePublicBookingSlotDurationMinutes(resolved.clientId, serviceParam);
  if (!durRes.ok) {
    return jsonWithMaybeCors(request, { ok: false, error: durRes.error }, { status: durRes.status });
  }

  const slots = await computePublicBookingSlotsForDay({
    clientId: resolved.clientId,
    settings,
    dateYmd: dateParam,
    nowMs,
    staffId,
    slotDurationMinutes: durRes.slotDurationMinutes,
  });

  return jsonWithMaybeCors(request, { ok: true, meta, slots, businessName: resolved.name });
}
