const DEFAULT_PATH = "/home";
const MAX_LEN = 2048;

/**
 * Pad na login / auth-callback. Ongeldige of cross-origin waarden → `/home`.
 * Blokkeert o.a. `//evil.example` (lijkt op een intern pad door `startsWith("/")`).
 */
export function safePostAuthRedirectPath(nextRaw: string | null | undefined, baseUrl: string): string {
  const raw = (nextRaw ?? "").trim().slice(0, MAX_LEN);
  if (raw === "") return DEFAULT_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_PATH;
  }
  try {
    const resolved = new URL(raw, baseUrl);
    const base = new URL(baseUrl);
    if (resolved.origin !== base.origin) return DEFAULT_PATH;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    return path || DEFAULT_PATH;
  } catch {
    return DEFAULT_PATH;
  }
}
