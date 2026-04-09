import { addDays, addMinutes } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type { BookingSettings } from "@/lib/booking/booking-settings";

export type BookingSlot = { starts_at: string; ends_at: string };

export type BusyInterval = { startMs: number; endMs: number };

/** Publieke slot-filter op basis van geplande diensten in het portaal. */
export type PublicDayRoster =
  | { kind: "legacy" }
  /** Alleen bij plannen per medewerker: er zijn diensten maar geen enkele telt mee voor boeken (bijv. alleen afwezig). */
  | { kind: "closed" }
  | { kind: "windows"; windows: BusyInterval[] };

export function mergeBusyIntervals(intervals: BusyInterval[]): BusyInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const out: BusyInterval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last || cur.startMs > last.endMs) {
      out.push({ startMs: cur.startMs, endMs: cur.endMs });
    } else {
      last.endMs = Math.max(last.endMs, cur.endMs);
    }
  }
  return out;
}

export function filterBookingSlotsByPublicRoster(slots: BookingSlot[], roster: PublicDayRoster): BookingSlot[] {
  if (roster.kind === "legacy") return slots;
  if (roster.kind === "closed") return [];
  const merged = mergeBusyIntervals(roster.windows);
  return slots.filter((slot) => {
    const s = new Date(slot.starts_at).getTime();
    const e = new Date(slot.ends_at).getTime();
    for (const w of merged) {
      if (s >= w.startMs && e <= w.endMs) return true;
    }
    return false;
  });
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

/** JS getDay in TZDate = 0 zo … 6 za → ISO 1…7 (ma=1, zo=7). */
function isoWeekday(d: TZDate): number {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

export function parseYmd(ymd: string): { y: number; mo: number; da: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const da = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return { y, mo, da };
}

export function formatYmdFromTzInstant(ms: number, timeZone: string): string {
  const z = new TZDate(ms, timeZone);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getBookingDayBoundsMs(
  dateYmd: string,
  timeZone: string,
): { startMs: number; endMs: number } | null {
  const parts = parseYmd(dateYmd);
  if (!parts) return null;
  const dayStart = new TZDate(parts.y, parts.mo - 1, parts.da, 0, 0, 0, timeZone);
  const nextDay = addDays(dayStart, 1);
  return { startMs: dayStart.getTime(), endMs: nextDay.getTime() };
}

export type ComputeBookingSlotsOptions = {
  /** Overschrijft `settings.slotDurationMinutes` (bijv. gekozen behandeling). */
  slotDurationMinutes?: number;
};

/**
 * Bouwt beschikbare slots voor één kalenderdag (ymd in `settings.timeZone`).
 */
export function computeBookingSlotsForDay(
  settings: BookingSettings,
  dateYmd: string,
  nowMs: number,
  busy: BusyInterval[],
  options?: ComputeBookingSlotsOptions,
): BookingSlot[] {
  const parts = parseYmd(dateYmd);
  if (!parts) return [];

  const tz = settings.timeZone;
  const dayStart = new TZDate(parts.y, parts.mo - 1, parts.da, 0, 0, 0, tz);
  const nextDay = addDays(dayStart, 1) as TZDate;

  const maxEnd = nowMs + settings.maxDaysAhead * 24 * 60 * 60 * 1000;
  if (dayStart.getTime() > maxEnd) return [];
  if (nextDay.getTime() <= nowMs) return [];

  const isoD = isoWeekday(dayStart);
  const dayCfg = settings.week.find((w) => w.day === isoD);
  if (!dayCfg || dayCfg.intervals.length === 0) return [];

  const slotMin = options?.slotDurationMinutes ?? settings.slotDurationMinutes;
  if (!Number.isFinite(slotMin) || slotMin < 10 || slotMin > 480) return [];
  const bufferMs = settings.bufferMinutes * 60 * 1000;
  const leadMs = settings.leadTimeMinutes * 60 * 1000;

  const bufferedBusy = busy.map((b) => ({
    startMs: b.startMs - bufferMs,
    endMs: b.endMs + bufferMs,
  }));

  function slotOverlapsBusy(startMs: number, endMs: number): boolean {
    for (const b of bufferedBusy) {
      if (startMs < b.endMs && b.startMs < endMs) return true;
    }
    return false;
  }

  const slots: BookingSlot[] = [];

  const sortedDayIntervals = [...dayCfg.intervals].sort(
    (x, y) => hmToMinutes(x.start) - hmToMinutes(y.start),
  );

  for (const interval of sortedDayIntervals) {
    const a = hmToMinutes(interval.start);
    const b = hmToMinutes(interval.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;

    for (let t = a; t + slotMin <= b; t += slotMin) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      const slotStart = new TZDate(parts.y, parts.mo - 1, parts.da, h, m, 0, tz);
      const slotEnd = addMinutes(slotStart, slotMin);

      const startMs = slotStart.getTime();
      const endMs = slotEnd.getTime();
      if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) continue;
      if (startMs < nowMs + leadMs) continue;
      if (slotOverlapsBusy(startMs, endMs)) continue;

      slots.push({
        starts_at: new Date(startMs).toISOString(),
        ends_at: new Date(endMs).toISOString(),
      });
    }
  }

  return slots;
}
