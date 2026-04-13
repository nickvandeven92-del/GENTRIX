/**
 * Relatief pad naar het ingebouwde bestelformulier (zelfde origin als de site-preview).
 * Behoud `token` voor concept en optioneel `flyer=1`.
 */
export function buildPublicStudioOrderHref(
  slug: string,
  opts: { previewToken?: string | null; flyer?: boolean },
): string {
  const enc = encodeURIComponent(slug);
  const q = new URLSearchParams();
  const t = opts.previewToken?.trim();
  if (t) q.set("token", t);
  if (opts.flyer) q.set("flyer", "1");
  const qs = q.toString();
  return qs ? `/site/${enc}/bestellen?${qs}` : `/site/${enc}/bestellen`;
}
