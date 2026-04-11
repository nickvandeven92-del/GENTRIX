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
function cleanQuery(raw: string): string {
  const stopWords = new Set([
    "met", "en", "voor", "van", "een", "het", "de", "die", "dat", "op",
    "in", "bij", "naar", "om", "als", "aan", "uit", "tot", "over",
    "with", "and", "for", "the", "a", "an", "of", "on", "at", "to",
  ]);
  return raw
    .replace(/[^\w\sÀ-ÿ-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()))
    .slice(0, 6)
    .join(" ")
    .trim();
}

const MAX_QUERY_WORDS = 10;

/** Voeg unieke termen uit de bedrijfsbriefing toe zodat stock-zoekopdrachten beter bij branche/thema blijven. */
function enrichQueryWithTheme(baseQuery: string, themeContext?: string): string {
  const t = themeContext?.trim();
  if (!t) return baseQuery;
  const themeClean = cleanQuery(t);
  if (!themeClean) return baseQuery;
  const baseWords = baseQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const baseSet = new Set(baseWords);
  const extras = themeClean
    .split(/\s+/)
    .filter((w) => w.length > 1 && !baseSet.has(w.toLowerCase()));
  const merged = [...baseWords, ...extras].slice(0, MAX_QUERY_WORDS).join(" ").trim();
  return merged || baseQuery;
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
    const matches = sec.html.matchAll(UNSPLASH_URL_RE);
    for (const m of matches) {
      const url = m[0];
      const alt = extractAltForUrl(sec.html, url);
      const rawQuery = alt ?? sec.sectionName ?? "professional business";
      const base = cleanQuery(rawQuery) || "professional business";
      const query = enrichQueryWithTheme(base, themeContext);
      entries.push({
        url,
        query,
        sectionIdx: si,
        sectionId: sec.id,
        sectionName: sec.sectionName ?? sec.id,
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
