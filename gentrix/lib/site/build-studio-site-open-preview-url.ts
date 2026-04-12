/**
 * Absolute `/site/[slug]` URL voor `window.open`, met optionele concept-`token`
 * (zelfde contract als `PublishedSiteView` / iframe-preview).
 */
export function buildStudioSiteOpenPreviewUrl(
  origin: string,
  subfolderSlug: string,
  draftPublicPreviewToken?: string | null,
): string {
  const slug = subfolderSlug.trim();
  const url = new URL(`/site/${encodeURIComponent(slug)}`, origin);
  const t = draftPublicPreviewToken?.trim();
  if (t) url.searchParams.set("token", t);
  return url.toString();
}
