import type { BookingSettings } from "@/lib/booking/booking-settings";
import { computePublicBookingSlotsForDay } from "@/lib/booking/compute-public-booking-slots-for-day";
import { TZDate } from "@date-fns/tz";

function ymdInTimeZone(isoDate: Date, timeZone: string): string {
  const z = new TZDate(isoDate.getTime(), timeZone);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Controleert of start/einde exact overeenkomt met een vrij publiek slot (herberekening server-side).
 */
export async function isValidPublicBookedSlot(
  clientId: string,
  settings: BookingSettings,
  startsAt: Date,
  endsAt: Date,
  nowMs: number,
  staffId?: string | null,
  slotDurationMinutes?: number,
): Promise<boolean> {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return false;
  if (endsAt.getTime() <= startsAt.getTime()) return false;

  const dateYmd = ymdInTimeZone(startsAt, settings.timeZone);
  const slots = await computePublicBookingSlotsForDay({
    clientId,
    settings,
    dateYmd,
    nowMs,
    staffId: staffId ?? undefined,
    slotDurationMinutes,
  });
  const sMs = startsAt.getTime();
  const eMs = endsAt.getTime();
  return slots.some((sl) => new Date(sl.starts_at).getTime() === sMs && new Date(sl.ends_at).getTime() === eMs);
}
