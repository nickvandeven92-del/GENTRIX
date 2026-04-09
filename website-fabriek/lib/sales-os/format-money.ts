/** Toon centen als EUR (nl). */
export function formatEURFromCents(cents: number): string {
  const n = cents / 100;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
