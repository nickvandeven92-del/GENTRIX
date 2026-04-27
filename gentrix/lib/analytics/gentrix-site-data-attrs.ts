/** Publieke site-HTML: stabiele first-party click-keys (blijft staan na strip van `data-studio-*`). */
export const GENTRIX_DATA_ATTR_ANALYTICS = "data-analytics";

/** Compacte key: `prefix:token` — alleen veilige tekens voor een dubbelgeciteerd attribuut. */
export function publicAnalyticsKeyFromToken(prefix: string, token: string): string {
  const p = prefix.replace(/[^a-z0-9_]/gi, "").slice(0, 24) || "x";
  const t = String(token)
    .trim()
    .replace(/[^a-zA-Z0-9:_\-./]/g, "-")
    .slice(0, 80);
  return `${p}:${t}`;
}
