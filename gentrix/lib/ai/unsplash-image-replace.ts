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
 * @param themeContext Optioneel: korte bedrijfsbeschrijving; wordt gemengd in de zoekterm voor betere branche-match.
 * @param relevance Optioneel: deterministische relevantie (gates + score) op Unsplash-resultaten — raakt generator-layout/copy niet.
 */
export async function replaceUnsplashImagesInSections(
  sections: TailwindSection[],
  accessKey?: string,
  themeContext?: string,
  relevance?: {
    designContract?: DesignGenerationContract | null;
    pageIntent?: UnsplashPageIntent;
  },
): Promise<TailwindSection[]> {
  if (!accessKey) return sections;

  // 1. Collect all URLs + their queries across all sections.
  type UrlEntry = {
    url: string;
    query: string;
    sectionIdx: number;
    sectionId: string;
    sectionName: string;
  };

  const entries: UrlEntry[] = [];

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    const sectionId = sec.id ?? `section-${si}`;
    const matches = sec.html.matchAll(UNSPLASH_URL_RE);
    for (const m of matches) {
      const url = m[0];
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
    }
  }

  if (entries.length === 0) return sections;

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

  if (replacements.size === 0) return sections;

  // 4. Apply replacements to section HTML.
  const updated = sections.map((sec) => {
    let html = sec.html;
    for (const [oldUrl, newUrl] of replacements) {
      if (html.includes(oldUrl)) {
        html = html.split(oldUrl).join(newUrl);
      }
    }
    return html !== sec.html ? { ...sec, html } : sec;
  });

  console.log(
    `[unsplash] Replaced ${replacements.size} image(s) across ${entries.length} occurrence(s).`,
  );

  return updated;
}
