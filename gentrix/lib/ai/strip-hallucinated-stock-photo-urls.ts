import type { GeneratedTailwindPage, TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/**
 * Verwijdert automatisch ingevulde stock-foto-URL's uit HTML die LLM's vaak reproduceren
 * (bekende host + `/photo-`-padpatroon uit trainingsvoorbeelden).
 * Geen externe stock-API: uitsluitend deterministische string-sanitatie.
 */
const HALLUCINATED_STOCK_PHOTO_URL_RE =
  /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+[^"'\s)>]*/g;

/** Snelle precheck — false negatives zijn onschuldig. */
export function htmlMayContainHallucinatedStockPhotoUrl(html: string): boolean {
  return html.includes("images.unsplash.com/photo-");
}

/** Mini-transparante GIF: tijdelijke src tussen range-replace en opruimen van `<img>`. */
const STRIPPED_PHOTO_URL_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Verwijdert `<img>` waarvan de src exact onze strip-placeholder is. */
export function removeImgsWithStrippedStockPlaceholder(html: string): string {
  const esc = escapeForRegExp(STRIPPED_PHOTO_URL_PLACEHOLDER);
  return html.replace(new RegExp(`<img\\b[^>]*\\bsrc=["']${esc}["'][^>]*>`, "gi"), "");
}

export function neutralizeStrippedStockBackgroundUrls(html: string): string {
  const esc = escapeForRegExp(STRIPPED_PHOTO_URL_PLACEHOLDER);
  return html.replace(new RegExp(`url\\(\\s*["']?${esc}["']?\\s*\\)`, "gi"), "none");
}

export function cleanupStrippedStockMarkup(html: string): string {
  return neutralizeStrippedStockBackgroundUrls(removeImgsWithStrippedStockPlaceholder(html));
}

/** Voor tests: vervangt overschotten URL-segmenten binnen gegeven ranges. */
export function replaceOverflowHallucinatedStockPhotoRanges(
  html: string,
  ranges: { start: number; end: number }[],
): string {
  if (ranges.length === 0) return html;
  const sorted = [...ranges].sort((a, b) => b.start - a.start);
  let out = html;
  for (const { start, end } of sorted) {
    if (start < 0 || end > out.length || start >= end) continue;
    const slice = out.slice(start, end);
    if (!slice.includes("images.unsplash.com/photo-")) continue;
    out = out.slice(0, start) + STRIPPED_PHOTO_URL_PLACEHOLDER + out.slice(end);
  }
  return out;
}

export function stripHallucinatedStockPhotoUrlsInHtml(html: string): string {
  const ranges: { start: number; end: number }[] = [];
  const re = new RegExp(HALLUCINATED_STOCK_PHOTO_URL_RE.source, HALLUCINATED_STOCK_PHOTO_URL_RE.flags);
  for (const m of html.matchAll(re)) {
    if (m.index === undefined) continue;
    ranges.push({ start: m.index, end: m.index + m[0].length });
  }
  return replaceOverflowHallucinatedStockPhotoRanges(html, ranges);
}

export function stripHallucinatedStockPhotoUrlsFromSections(sections: TailwindSection[]): TailwindSection[] {
  return sections.map((s) => {
    let h = stripHallucinatedStockPhotoUrlsInHtml(s.html);
    h = cleanupStrippedStockMarkup(h);
    return h === s.html ? s : { ...s, html: h };
  });
}

/** Verwijdert resterende automatisch ingevulde stock-foto-URL's uit landings-, contact- en marketingsecties. */
export function stripHallucinatedStockPhotoUrlsFromGeneratedTailwindPage(
  data: GeneratedTailwindPage,
): GeneratedTailwindPage {
  const marketing =
    data.marketingPages != null && Object.keys(data.marketingPages).length > 0
      ? Object.fromEntries(
          Object.entries(data.marketingPages).map(([slug, secs]) => [
            slug,
            stripHallucinatedStockPhotoUrlsFromSections(secs),
          ]),
        )
      : undefined;
  return {
    ...data,
    sections: stripHallucinatedStockPhotoUrlsFromSections(data.sections),
    ...(data.contactSections != null && data.contactSections.length > 0
      ? { contactSections: stripHallucinatedStockPhotoUrlsFromSections(data.contactSections) }
      : {}),
    ...(marketing != null ? { marketingPages: marketing } : {}),
  };
}
