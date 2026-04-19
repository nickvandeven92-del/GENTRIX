import type { GeneratedTailwindPage, TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/**
 * Verwijdert hardcoded `images.unsplash.com/photo-*`-URL’s uit HTML.
 * **Geen** Unsplash- of andere stock-API: LLM’s produceren deze URL’s vaak uit trainingsvoorbeelden;
 * dit bestand is uitsluitend deterministische string-sanitatie.
 */
/** Regex die typische model-gehallucineerde Unsplash-photo-URL's matcht. */
const UNSPLASH_URL_RE =
  /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+[^"'\s)>]*/g;

/** Snelle precheck — false negatives zijn onschuldig. */
export function htmlMayContainUnsplashPhotoUrl(html: string): boolean {
  return html.includes("images.unsplash.com/photo-");
}

/** Mini-transparante GIF: tijdelijke src tussen range-replace en opruimen van `<img>`. */
const UNSPLASH_OVERFLOW_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Verwijdert `<img>` waarvan de src exact onze strip-placeholder is. */
export function removeImgsWithStrippedStockPlaceholder(html: string): string {
  const esc = escapeForRegExp(UNSPLASH_OVERFLOW_PLACEHOLDER);
  return html.replace(new RegExp(`<img\\b[^>]*\\bsrc=["']${esc}["'][^>]*>`, "gi"), "");
}

export function neutralizeStrippedStockBackgroundUrls(html: string): string {
  const esc = escapeForRegExp(UNSPLASH_OVERFLOW_PLACEHOLDER);
  return html.replace(new RegExp(`url\\(\\s*["']?${esc}["']?\\s*\\)`, "gi"), "none");
}

export function cleanupStrippedStockMarkup(html: string): string {
  return neutralizeStrippedStockBackgroundUrls(removeImgsWithStrippedStockPlaceholder(html));
}

/** Voor tests: vervangt overschotten `photo-` URL-segmenten. */
export function replaceOverflowUnsplashRanges(html: string, ranges: { start: number; end: number }[]): string {
  if (ranges.length === 0) return html;
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let out = html;
  for (const { start, end } of sorted) {
    if (start < 0 || end > out.length || start >= end) continue;
    const slice = out.slice(start, end);
    if (!slice.includes("images.unsplash.com/photo-")) continue;
    out = out.slice(0, start) + UNSPLASH_OVERFLOW_PLACEHOLDER + out.slice(end);
  }
  return out;
}

/** Verwijdert alle Unsplash-photo-URL's uit HTML (geen externe API). */
export function stripAllUnsplashPhotoUrlsInHtml(html: string): string {
  const ranges: { start: number; end: number }[] = [];
  const re = new RegExp(UNSPLASH_URL_RE.source, UNSPLASH_URL_RE.flags);
  for (const m of html.matchAll(re)) {
    if (m.index === undefined) continue;
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return replaceOverflowUnsplashRanges(html, ranges);
}

export function stripAllUnsplashFromSections(sections: TailwindSection[]): TailwindSection[] {
  return sections.map((s) => {
    let h = stripAllUnsplashPhotoUrlsInHtml(s.html);
    h = cleanupStrippedStockMarkup(h);
    return h === s.html ? s : { ...s, html: h };
  });
}

/** Verwijdert rest-Unsplash-URL's uit landings-, contact- en marketingsecties. */
export function stripUnsplashUrlsFromGeneratedTailwindPage(data: GeneratedTailwindPage): GeneratedTailwindPage {
  const marketing =
    data.marketingPages != null && Object.keys(data.marketingPages).length > 0
      ? Object.fromEntries(
          Object.entries(data.marketingPages).map(([slug, secs]) => [slug, stripAllUnsplashFromSections(secs)]),
        )
      : undefined;
  return {
    ...data,
    sections: stripAllUnsplashFromSections(data.sections),
    ...(data.contactSections != null && data.contactSections.length > 0
      ? { contactSections: stripAllUnsplashFromSections(data.contactSections) }
      : {}),
    ...(marketing != null ? { marketingPages: marketing } : {}),
  };
}
