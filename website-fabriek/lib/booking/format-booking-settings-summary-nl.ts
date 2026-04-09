import type { BookingSettings } from "@/lib/booking/booking-settings";
import { BOOKING_ISO_DAYS } from "@/lib/booking/booking-day-meta";

/** Korte NL-tekst voor admin/overzicht. */
export function formatBookingSettingsSummaryNl(settings: BookingSettings): string {
  const label = (d: number) => BOOKING_ISO_DAYS.find((x) => x.day === d)?.short ?? String(d);
  const parts = [...settings.week]
    .filter((w) => w.intervals.length > 0)
    .sort((a, b) => a.day - b.day)
    .map((w) => {
      const iv = w.intervals.map((i) => `${i.start}–${i.end}`).join(", ");
      return `${label(w.day)} ${iv}`;
    });
  if (parts.length === 0) return "Geen werkdagen gemarkeerd (bezoekers zien geen slots op /boek).";
  return `${settings.timeZone} · ${settings.slotDurationMinutes} min · ${parts.join(" · ")}`;
}
