import { TZDate } from "@date-fns/tz";

export type BookingMeta = {
  todayYmd: string;
  maxYmd: string;
  timeZone: string;
  slotDurationMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
};

export type PublicBookingSlot = { starts_at: string; ends_at: string };

export type PublicBookingService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  sort_order: number;
};

export type StaffDayState = {
  loading: boolean;
  requiresStaffSelection: boolean;
  staff: { id: string; name: string }[];
  err: string | null;
};

export function formatPriceEur(cents: number | null): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function ymdCompare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function buildMonthGrid(
  year: number,
  month1: number,
  timeZone: string,
): { ymd: string; label: number; inMonth: boolean }[] {
  const dim = daysInMonth(year, month1);
  const prevDim = daysInMonth(year, month1 - 1);
  const first = new TZDate(year, month1 - 1, 1, 12, 0, 0, timeZone);
  const dow = first.getDay();
  const mondayFirst = dow === 0 ? 6 : dow - 1;
  const cells: { ymd: string; label: number; inMonth: boolean }[] = [];
  for (let i = 0; i < mondayFirst; i++) {
    const d = prevDim - mondayFirst + i + 1;
    const pm = month1 === 1 ? 12 : month1 - 1;
    const py = month1 === 1 ? year - 1 : year;
    cells.push({ ymd: `${py}-${pad2(pm)}-${pad2(d)}`, label: d, inMonth: false });
  }
  for (let d = 1; d <= dim; d++) {
    cells.push({ ymd: `${year}-${pad2(month1)}-${pad2(d)}`, label: d, inMonth: true });
  }
  const nm = month1 === 12 ? 1 : month1 + 1;
  const ny = month1 === 12 ? year + 1 : year;
  let n = 1;
  while (cells.length < 42) {
    cells.push({ ymd: `${ny}-${pad2(nm)}-${pad2(n)}`, label: n, inMonth: false });
    n += 1;
  }
  return cells;
}
