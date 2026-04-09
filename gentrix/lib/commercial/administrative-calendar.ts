/**
 * Administratieve kalender voor documentnummers (CL/OFF/INV).
 * Altijd expliciet Europe/Amsterdam — geen impliciete server-local of UTC voor het jaardeel.
 */

export const ADMINISTRATIVE_TIMEZONE = "Europe/Amsterdam";

const yearFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: ADMINISTRATIVE_TIMEZONE,
  year: "numeric",
});

/**
 * Kalenderjaar in Amsterdam op het gegeven moment (bijv. voor INV-2026-001).
 */
export function getAdministrativeYear(date: Date = new Date(), timeZone = ADMINISTRATIVE_TIMEZONE): number {
  const fmt =
    timeZone === ADMINISTRATIVE_TIMEZONE
      ? yearFmt
      : new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" });
  const y = parseInt(fmt.format(date), 10);
  if (!Number.isFinite(y)) {
    throw new Error(`getAdministrativeYear: ongeldig jaar voor zone ${timeZone}`);
  }
  return y;
}
