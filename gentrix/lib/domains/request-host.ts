/** Host uit request: lowercase, zonder poort. */
export function normalizeRequestHost(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const h = hostHeader.split(":")[0]?.trim().toLowerCase();
  return h || null;
}

/**
 * True als we een lookup op custom_domain in de database proberen.
 * Primaire studio-host(s) en Vercel-default-URL slaan we over (slug-routes blijven daar).
 */
export function shouldResolveCustomDomain(host: string): boolean {
  if (host === "localhost" || host.startsWith("127.0.0.1")) return false;

  const primary = process.env.NEXT_PUBLIC_PRIMARY_HOST?.trim().toLowerCase();
  if (primary && host === primary) return false;

  const aliases = (process.env.NEXT_PUBLIC_PRIMARY_HOST_ALIASES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (aliases.includes(host)) return false;

  if (host.endsWith(".vercel.app")) return false;

  return true;
}
