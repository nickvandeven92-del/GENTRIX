import type { BookingSettings } from "@/lib/booking/booking-settings";
import { formatYmdFromTzInstant } from "@/lib/booking/compute-booking-slots";

export type BookingCalendarMeta = {
  todayYmd: string;
  maxYmd: string;
  timeZone: string;
  slotDurationMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
};

export function getBookingCalendarMeta(settings: BookingSettings, nowMs: number): BookingCalendarMeta {
  const tz = settings.timeZone;
  const todayYmd = formatYmdFromTzInstant(nowMs, tz);
  const maxInstant = nowMs + settings.maxDaysAhead * 24 * 60 * 60 * 1000;
  const maxYmd = formatYmdFromTzInstant(maxInstant, tz);
  return {
    todayYmd,
    maxYmd,
    timeZone: settings.timeZone,
    slotDurationMinutes: settings.slotDurationMinutes,
    leadTimeMinutes: settings.leadTimeMinutes,
    maxDaysAhead: settings.maxDaysAhead,
  };
}
