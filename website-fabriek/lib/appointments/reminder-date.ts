/**
 * Kalenderdatum (YYYY-MM-DD) in Europe/Amsterdam voor een tijdstip.
 */
export function formatDateKeyAmsterdam(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Gregoriaanse +1 dag op een YYYY-MM-DD string (UTC-middag als anker). */
export function addOneCalendarDayYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  t.setUTCDate(t.getUTCDate() + 1);
  const y2 = t.getUTCFullYear();
  const m2 = t.getUTCMonth() + 1;
  const d2 = t.getUTCDate();
  return `${y2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;
}

/** Amsterdam-“morgen” relatief aan `ref` (zelfde betekenis als cron op een vaste dag draait). */
export function tomorrowDateKeyAmsterdam(ref: Date = new Date()): string {
  return addOneCalendarDayYmd(formatDateKeyAmsterdam(ref));
}
