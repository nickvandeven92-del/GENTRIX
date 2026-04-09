/** Bouwt absolute origin voor server-side fetch/Playwright (zelfde host als de inkomende request). */
export function originFromRequest(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !host.trim()) {
    throw new Error("Geen Host-header; kan publieke site-URL niet bepalen.");
  }
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto =
    forwarded?.split(",")[0]?.trim() ??
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host.trim()}`;
}
