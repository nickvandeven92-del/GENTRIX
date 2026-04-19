import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  marketingPageKeysWithContent,
  resolveMarketingPageKeyForUrlSegment,
} from "@/lib/site/marketing-path-aliases";

const STUDIO_SITE_BASE_PATH_RE = /__STUDIO_SITE_BASE__\/([a-z0-9]+(?:-[a-z0-9]+)*)/gi;

/** Publieke app-routes / gereserveerde segmenten — geen marketing-HTML verwacht. */
const RESERVED_MARKETING_NAV_SEGMENTS = new Set([
  "contact",
  "boek",
  "winkel",
  "api",
  "admin",
  "portal",
  "preview",
  "site",
  "home",
]);

function collectSegmentsFromHtml(html: string): Set<string> {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(STUDIO_SITE_BASE_PATH_RE.source, "gi");
  while ((m = re.exec(html)) !== null) {
    const seg = m[1]?.toLowerCase();
    if (seg && !RESERVED_MARKETING_NAV_SEGMENTS.has(seg)) out.add(seg);
  }
  return out;
}

export function collectMarketingNavSegmentsFromSiteHtml(parts: {
  sections: readonly TailwindSection[];
  contactSections?: readonly TailwindSection[] | null;
}): Set<string> {
  const out = new Set<string>();
  for (const s of parts.sections) {
    for (const x of collectSegmentsFromHtml(s.html)) out.add(x);
  }
  for (const s of parts.contactSections ?? []) {
    for (const x of collectSegmentsFromHtml(s.html)) out.add(x);
  }
  return out;
}

/**
 * `null` = OK. Anders korte fouttekst voor API/UI (nav belooft subroutes zonder `marketingPages`).
 */
export function describeTailwindMarketingNavPayloadIssues(parts: {
  sections: readonly TailwindSection[];
  contactSections?: readonly TailwindSection[] | null;
  marketingPages?: Record<string, TailwindSection[]> | null;
}): string | null {
  const segments = collectMarketingNavSegmentsFromSiteHtml(parts);
  if (segments.size === 0) return null;

  const pagesRecord = parts.marketingPages as Record<string, unknown> | null | undefined;
  const keysWithContent = marketingPageKeysWithContent(pagesRecord ?? null);
  if (keysWithContent.length === 0) {
    return `De HTML bevat links naar __STUDIO_SITE_BASE__/… (${[...segments].sort().join(", ")}) maar marketingPages ontbreekt of is leeg. Genereer opnieuw als multipage-site of pas de navigatie aan (geen studio-placeholders zonder subpagina's).`;
  }

  const missing: string[] = [];
  for (const seg of segments) {
    const resolved = resolveMarketingPageKeyForUrlSegment(seg, pagesRecord ?? null);
    if (!resolved) missing.push(seg);
  }
  if (missing.length > 0) {
    return `Marketing-nav verwijst naar ${missing.join(", ")} maar die slugs ontbreken in marketingPages (beschikbaar: ${keysWithContent.join(", ")}).`;
  }
  return null;
}
