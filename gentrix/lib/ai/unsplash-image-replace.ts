import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import {
  pickBestUnsplashResult,
  type UnsplashPageIntent,
} from "@/lib/ai/image-relevance-policy";
import type { TailwindSection } from "./tailwind-sections-schema";

// ---------------------------------------------------------------------------
// Unsplash image replacement — post-processing step
// Replaces Claude's hallucinated photo-IDs with real Unsplash images matched
// on alt text / section context via the Unsplash Search API.
// ---------------------------------------------------------------------------

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const PER_PAGE = 10;
const REQUEST_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 30_000;
const INTER_REQUEST_DELAY_MS = 120;

/** Regex that matches any hallucinated Unsplash photo URL. */
const UNSPLASH_URL_RE =
  /https:\/\/images\.unsplash\.com\/photo-[a-zA-Z0-9_-]+[^"'\s)>]*/g;

/** Snelle precheck vóór zware passes — false negatives zijn onschuldig (regex in replace vangt zeldzame varianten). */
export function htmlMayContainUnsplashPhotoUrl(html: string): boolean {
  return html.includes("images.unsplash.com/photo-");
}

/** Standaard cap: te veel stock per sectie = trage Unsplash-stap + visuele herhaling. */
export const DEFAULT_UNSPLASH_MAX_IMAGES_PER_SECTION = 4;

function parseEnvPositiveInt(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type ReplaceUnsplashRelevanceOptions = {
  designContract?: DesignGenerationContract | null;
  pageIntent?: UnsplashPageIntent;
  /** Overschrijft \`UNSPLASH_MAX_IMAGES_PER_SECTION\` voor deze call. */
  maxImagesPerSection?: number;
  /** Overschrijft \`UNSPLASH_MAX_IMAGES_PER_PAGE\` (0 in env = uit). */
  maxImagesPerPage?: number;
  /**
   * `false` = Unsplash overal resolven (oud gedrag). Standaard **aan**: alleen \`id: "gallery"\` krijgt API-resolve (Lovable-achtig: geen stock-hero);
   * hero-stock optioneel via \`SITE_GENERATION_UNSPLASH_ALLOW_HERO=1\`. Elders worden \`images.unsplash.com/photo-…\` geneutraliseerd.
   */
  galleryOnlyStock?: boolean;
};

/** Standaard **uit**: geen Unsplash in hero — alleen expliciete \`gallery\`-sectie. Zet \`SITE_GENERATION_UNSPLASH_ALLOW_HERO=1\` om hero/header/banner wél te laten matchen. */
export function isUnsplashHeroStockResolveEnabled(): boolean {
  const v = process.env.SITE_GENERATION_UNSPLASH_ALLOW_HERO?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Standaard: geen stock-foto's behalve \`gallery\` (+ optioneel hero via env; zet \`SITE_GENERATION_UNSPLASH_GALLERY_ONLY=0\` voor Unsplash overal). */
export function isGalleryOnlyUnsplashStockMode(opts?: ReplaceUnsplashRelevanceOptions): boolean {
  if (opts?.galleryOnlyStock === false) return false;
  if (opts?.galleryOnlyStock === true) return true;
  const v = process.env.SITE_GENERATION_UNSPLASH_GALLERY_ONLY?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

export function isUnsplashGallerySection(sec: Pick<TailwindSection, "id">): boolean {
  return String(sec.id ?? "").trim().toLowerCase() === "gallery";
}

/**
 * In gallery-only modus: hier mag Unsplash wél via de API worden opgelost.
 * Standaard **alleen** \`id: "gallery"\` (image-vrije site); hero wanneer \`SITE_GENERATION_UNSPLASH_ALLOW_HERO=1\`.
 */
export function allowsUnsplashStockResolveInGalleryOnlyMode(
  sec: Pick<TailwindSection, "id" | "sectionName">,
  sectionIndex: number,
): boolean {
  if (isUnsplashGallerySection(sec)) return true;
  if (!isUnsplashHeroStockResolveEnabled()) return false;
  const sectionId = String(sec.id ?? `section-${sectionIndex}`).trim() || `section-${sectionIndex}`;
  return isHeroLikeSection(sectionId, sec.sectionName ?? "", sectionIndex);
}

/** Verwijdert alle Unsplash-photo-URL's uit HTML (placeholder); geen API. */
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
    let html = stripAllUnsplashPhotoUrlsInHtml(s.html);
    html = cleanupStrippedStockMarkup(html);
    return html === s.html ? s : { ...s, html };
  });
}

function resolveUnsplashImageLimits(opts?: ReplaceUnsplashRelevanceOptions): {
  perSection: number;
  perPage: number | null;
} {
  const perSection =
    opts?.maxImagesPerSection ?? parseEnvPositiveInt("UNSPLASH_MAX_IMAGES_PER_SECTION", DEFAULT_UNSPLASH_MAX_IMAGES_PER_SECTION);
  if (opts?.maxImagesPerPage != null) {
    return { perSection, perPage: opts.maxImagesPerPage > 0 ? opts.maxImagesPerPage : null };
  }
  const envPage = parseEnvPositiveInt("UNSPLASH_MAX_IMAGES_PER_PAGE", 0);
  return { perSection, perPage: envPage > 0 ? envPage : null };
}

/** Mini-transparante GIF: tijdelijke src tussen range-replace en opruimen van `<img>`. */
const UNSPLASH_OVERFLOW_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function escapeForRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Verwijdert `<img>` waarvan de src exact onze strip-placeholder is (geen klant-URL). */
export function removeImgsWithStrippedStockPlaceholder(html: string): string {
  const esc = escapeForRegExp(UNSPLASH_OVERFLOW_PLACEHOLDER);
  return html.replace(new RegExp(`<img\\b[^>]*\\bsrc=["']${esc}["'][^>]*>`, "gi"), "");
}

/** Vervangt `url(placeholder)` door `none` zodat geen lege stock-achtergrond blijft hangen. */
export function neutralizeStrippedStockBackgroundUrls(html: string): string {
  const esc = escapeForRegExp(UNSPLASH_OVERFLOW_PLACEHOLDER);
  return html.replace(new RegExp(`url\\(\\s*["']?${esc}["']?\\s*\\)`, "gi"), "none");
}

/** Na Unsplash-strip: schone DOM zonder placeholder-`<img>` / lege bg-url. */
export function cleanupStrippedStockMarkup(html: string): string {
  return neutralizeStrippedStockBackgroundUrls(removeImgsWithStrippedStockPlaceholder(html));
}

/** Voor tests: vervangt overschotten `photo-` URL-segmenten (zonder Unsplash API). */
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

function replaceOccurrenceLimited(html: string, search: string, replacement: string, maxOccurrences: number): string {
  if (maxOccurrences <= 0 || !search) return html;
  let count = 0;
  let idx = 0;
  let result = html;
  while (count < maxOccurrences) {
    const pos = result.indexOf(search, idx);
    if (pos === -1) break;
    result = result.slice(0, pos) + replacement + result.slice(pos + search.length);
    idx = pos + replacement.length;
    count++;
  }
  return result;
}

/** Extract the alt attribute value from the <img> tag that contains the URL. */
function extractAltForUrl(html: string, url: string): string | null {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const imgTagRe = new RegExp(
    `<img[^>]*src=["']${escaped}["'][^>]*>`,
    "is",
  );
  const match = html.match(imgTagRe);
  if (!match) {
    const imgTagReReversed = new RegExp(
      `<img[^>]*alt=["']([^"']*)["'][^>]*src=["']${escaped}["'][^>]*>`,
      "is",
    );
    const m2 = html.match(imgTagReReversed);
    if (m2) return m2[1] || null;
    return null;
  }
  const altRe = /alt=["']([^"']*)["']/i;
  const altMatch = match[0].match(altRe);
  return altMatch ? altMatch[1] || null : null;
}

/** Strip filler words to produce a better Unsplash search query. */
function cleanQuery(raw: string, maxWords = 6): string {
  const stopWords = new Set([
    "met", "en", "voor", "van", "een", "het", "de", "die", "dat", "op",
    "in", "bij", "naar", "om", "als", "aan", "uit", "tot", "over",
    "with", "and", "for", "the", "a", "an", "of", "on", "at", "to",
    "this", "that", "from", "into", "also", "just", "your", "our",
  ]);
  return raw
    .replace(/[^\w\sÀ-ÿ-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .slice(0, maxWords)
    .join(" ")
    .trim();
}

const MAX_QUERY_WORDS = 12;

function mergeDistinctWordLists(primary: string[], secondary: string[], max: number): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of primary) {
    const k = w.toLowerCase();
    if (w.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= max) return out.join(" ");
  }
  for (const w of secondary) {
    const k = w.toLowerCase();
    if (w.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length >= max) break;
  }
  return out.join(" ").trim();
}

/** Zelfde heuristiek als hero-enhancement: eerste marketingblok = hero. */
function isHeroLikeSection(sectionId: string, sectionName: string, sectionIndex: number): boolean {
  const id = (sectionId ?? "").toLowerCase();
  const name = (sectionName ?? "").toLowerCase();
  if (id === "hero" || id.startsWith("hero") || id === "header" || id === "banner") return true;
  if (/\bhero\b/i.test(name)) return true;
  if (sectionIndex === 0 && (id.includes("intro") || id.includes("welcome"))) return true;
  return false;
}

/**
 * Bouwt de Unsplash Search-query. Voor **hero**: briefing/thema eerst (branche-eerst),
 * daarna `alt`/sectienaam — zo volgen stock-resultaten de input, vergelijkbaar met tools die sector-keywords zwaar wegen.
 */
export function composeUnsplashSearchQuery(opts: {
  altText: string | null;
  sectionName: string;
  sectionId: string;
  sectionIndex: number;
  themeContext?: string;
}): string {
  const rawAlt = opts.altText ?? opts.sectionName ?? "professional business";
  const baseWords = cleanQuery(rawAlt, 10).split(/\s+/).filter(Boolean);
  const base = baseWords.join(" ") || "professional business";
  const themeRaw = opts.themeContext?.trim() ?? "";
  const themeWords = themeRaw ? cleanQuery(themeRaw, 18).split(/\s+/).filter(Boolean) : [];

  const hero = isHeroLikeSection(opts.sectionId, opts.sectionName, opts.sectionIndex);

  if (themeWords.length === 0) return base;

  if (hero) {
    /** Niet alle 12 slots met briefing vullen — zo blijven concrete `alt`-keywords (scène) meewegen. */
    const themeLead = themeWords.slice(0, 7);
    const q = mergeDistinctWordLists(themeLead, baseWords, MAX_QUERY_WORDS);
    return q || base;
  }
  const q = mergeDistinctWordLists(baseWords, themeWords, MAX_QUERY_WORDS);
  return q || base;
}

interface UnsplashSearchResult {
  urls: { regular: string; small: string; raw: string };
  alt_description: string | null;
  description?: string | null;
}

async function searchUnsplash(
  query: string,
  accessKey: string,
  perPage = PER_PAGE,
): Promise<UnsplashSearchResult[]> {
  const params = new URLSearchParams({
    query,
    per_page: String(perPage),
    orientation: "landscape",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${UNSPLASH_SEARCH_URL}?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[unsplash] Search failed (${res.status}) for "${query}"`);
      return [];
    }
    const data = await res.json();
    return (data.results ?? []) as UnsplashSearchResult[];
  } catch (err) {
    console.warn(`[unsplash] Search error for "${query}":`, err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Small helper to wait between requests. */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Scan every section's HTML for hallucinated Unsplash photo URLs and replace
 * them with real images found via the Unsplash Search API.
 *
 * - Graceful degradation: returns sections unchanged when no access key.
 * - Deduplicates queries: same alt text → same result set.
 * - Uniqueness: picks different photos from the result set for the same query.
 * - Respects rate limits with inter-request delays and a total timeout.
 * - **Cap:** standaard `DEFAULT_UNSPLASH_MAX_IMAGES_PER_SECTION` resolves per sectie (+ optioneel per pagina); rest → transparante placeholder (geen extra API).
 * - **Gallery-only (standaard):** Unsplash wordt **alleen** in \`id: "gallery"\` opgelost; elders → placeholder. Optioneel hero: \`SITE_GENERATION_UNSPLASH_ALLOW_HERO=1\`. Zet \`SITE_GENERATION_UNSPLASH_GALLERY_ONLY=0\` om overal te resolven.
 * @param themeContext Optioneel: korte bedrijfsbeschrijving; wordt gemengd in de zoekterm voor betere branche-match.
 * @param relevance Optioneel: relevantie + optioneel `maxImagesPerSection` / `maxImagesPerPage` (of env `UNSPLASH_MAX_*`).
 */
export async function replaceUnsplashImagesInSections(
  sections: TailwindSection[],
  accessKey?: string,
  themeContext?: string,
  relevance?: ReplaceUnsplashRelevanceOptions,
): Promise<TailwindSection[]> {
  const galleryOnlyStock = isGalleryOnlyUnsplashStockMode(relevance);

  if (!sections.some((s) => htmlMayContainUnsplashPhotoUrl(s.html))) {
    return sections;
  }

  if (!accessKey) {
    return stripAllUnsplashFromSections(sections);
  }

  const limits = resolveUnsplashImageLimits(relevance);

  // 1. Collect URL entries (capped) + per-sectie kept-telling + overflow-ranges.
  type UrlEntry = {
    url: string;
    query: string;
    sectionIdx: number;
    sectionId: string;
    sectionName: string;
  };

  const entries: UrlEntry[] = [];
  const keptUrlCountsPerSection = new Map<number, Map<string, number>>();
  const overflowRangesBySection = new Map<number, { start: number; end: number }[]>();

  let pageKeptCount = 0;

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const sectionId = sec.id ?? `section-${si}`;
    const localKept = new Map<string, number>();
    const localOverflow: { start: number; end: number }[] = [];
    let sectionKeptCount = 0;

    const allowUnsplashApiResolve = !galleryOnlyStock || allowsUnsplashStockResolveInGalleryOnlyMode(sec, si);

    const matchList = [...sec.html.matchAll(UNSPLASH_URL_RE)];
    for (const m of matchList) {
      const url = m[0];
      const idx = m.index;
      if (idx === undefined) continue;
      const end = idx + url.length;
      const withinSection = sectionKeptCount < limits.perSection;
      const withinPage = limits.perPage == null || pageKeptCount < limits.perPage;

      if (allowUnsplashApiResolve && withinSection && withinPage) {
        sectionKeptCount += 1;
        pageKeptCount += 1;
        localKept.set(url, (localKept.get(url) ?? 0) + 1);
        const alt = extractAltForUrl(sec.html, url);
        const query = composeUnsplashSearchQuery({
          altText: alt,
          sectionName: sec.sectionName ?? sectionId,
          sectionId,
          sectionIndex: si,
          themeContext,
        });
        entries.push({
          url,
          query,
          sectionIdx: si,
          sectionId,
          sectionName: sec.sectionName ?? sectionId,
        });
      } else {
        localOverflow.push({ start: idx, end });
      }
    }

    keptUrlCountsPerSection.set(si, localKept);
    if (localOverflow.length > 0) overflowRangesBySection.set(si, localOverflow);
  }

  const overflowTotal = [...overflowRangesBySection.values()].reduce((n, a) => n + a.length, 0);
  if (entries.length === 0 && overflowTotal === 0) return sections;

  // 2. Deduplicate queries and fetch results.
  const queryCache = new Map<string, UnsplashSearchResult[]>();
  const queryPickIndex = new Map<string, number>();
  const uniqueQueries = [...new Set(entries.map((e) => e.query))];

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  for (let i = 0; i < uniqueQueries.length; i++) {
    if (Date.now() > deadline) {
      console.warn("[unsplash] Total timeout reached, stopping further searches.");
      break;
    }
    const q = uniqueQueries[i];
    const results = await searchUnsplash(q, accessKey);
    queryCache.set(q, results);
    queryPickIndex.set(q, 0);

    if (i < uniqueQueries.length - 1) {
      await delay(INTER_REQUEST_DELAY_MS);
    }
  }

  // 3. Build a replacement map: old URL → new URL.
  const replacements = new Map<string, string>();

  const pageIntent: UnsplashPageIntent = relevance?.pageIntent ?? "home";
  const designContract = relevance?.designContract;

  for (const entry of entries) {
    if (replacements.has(entry.url)) continue;

    const results = queryCache.get(entry.query);
    if (!results || results.length === 0) continue;

    const pickIdx = queryPickIndex.get(entry.query) ?? 0;
    queryPickIndex.set(entry.query, pickIdx + 1);

    const theme = themeContext ?? "";
    const picked = pickBestUnsplashResult(results, {
      themeContext: theme,
      sectionId: entry.sectionId,
      sectionName: entry.sectionName,
      pageIntent,
      designContract,
      pickOffset: pickIdx,
    });
    const photo = picked?.photo ?? results[pickIdx % results.length];
    const newUrl = photo.urls.regular;
    if (newUrl) {
      replacements.set(entry.url, newUrl);
    }
  }

  if (replacements.size === 0 && overflowTotal === 0) return sections;

  // 4. Eerst overflow → placeholder; daarna max. N× `oldUrl` → `newUrl` per sectie (zelfde URL meerdere keren in sectie).
  const updated = sections.map((sec, si) => {
    let html = sec.html;
    const overflows = overflowRangesBySection.get(si);
    if (overflows?.length) {
      html = replaceOverflowUnsplashRanges(html, overflows);
    }
    const keptMap = keptUrlCountsPerSection.get(si) ?? new Map();
    for (const [oldUrl, newUrl] of replacements) {
      const k = keptMap.get(oldUrl) ?? 0;
      if (k > 0) {
        html = replaceOccurrenceLimited(html, oldUrl, newUrl, k);
      }
    }
    if (galleryOnlyStock && !allowsUnsplashStockResolveInGalleryOnlyMode(sec, si)) {
      html = cleanupStrippedStockMarkup(html);
    }
    return html !== sec.html ? { ...sec, html } : sec;
  });

  const cappedOccurrences = [...keptUrlCountsPerSection.values()].reduce((n, m) => {
    for (const c of m.values()) n += c;
    return n;
  }, 0);
  console.log(
    `[unsplash] galleryOnly=${galleryOnlyStock} — replaced ${replacements.size} distinct URL(s); ${cappedOccurrences} kept occurrence(s); ${overflowTotal} overflow → placeholder (cap ${limits.perSection}/sectie${limits.perPage != null ? `, ${limits.perPage}/pagina` : ""}).`,
  );

  return updated;
}
