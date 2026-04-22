/**
 * Eerste niet-lege waarde uit `x-forwarded-for` (Vercel/Cloudflare-stijl) of `x-real-ip`.
 * Geeft `"unknown"` als geen van beide beschikbaar is zodat rate-limit keys deterministisch blijven.
 */
export function extractClientIp(headers: Headers): string {
  const xf = headers.get("x-forwarded-for");
  const first = xf?.split(",")[0]?.trim();
  if (first) return first;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
