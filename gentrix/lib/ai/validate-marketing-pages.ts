import { walkBalancedSameLocalBlock } from "@/lib/site/html-balanced-element";
import { findHtmlOpenTagEnd } from "@/lib/site/html-open-tag";

const STUDIO_SITE_BASE_SUBPATH_RE = /__STUDIO_SITE_BASE__\/([a-z0-9-]+)/gi;
const STUDIO_FAQ_PATH = "__STUDIO_SITE_BASE__/faq";

type MarketingSectionRow = { id: string; html: string };

/** Verwijdert `<header>…</header>`-blokken (case-insensitive) voor checks op body/footer. */
export function stripHtmlHeaderBlocks(html: string): string {
  let cursor = 0;
  let out = "";
  let pos = 0;
  while (pos < html.length) {
    const m = /<header\b/gi.exec(html.slice(pos));
    if (!m) break;
    const abs = pos + m.index;
    const w = walkBalancedSameLocalBlock(html, abs, "header");
    if (!w) {
      pos = abs + 1;
      continue;
    }
    out += html.slice(cursor, w.start);
    cursor = w.end;
    pos = w.end;
  }
  out += html.slice(cursor);
  return out;
}

/** Alleen de inhoud binnen `<header>` (concat) — om te verbieden dat FAQ daar linked wordt. */
export function collectHtmlHeaderInnerHtml(html: string): string {
  const chunks: string[] = [];
  let pos = 0;
  while (pos < html.length) {
    const m = /<header\b/gi.exec(html.slice(pos));
    if (!m) break;
    const abs = pos + m.index;
    const w = walkBalancedSameLocalBlock(html, abs, "header");
    if (!w) {
      pos = abs + 1;
      continue;
    }
    const block = w.block;
    const innerStart = findHtmlOpenTagEnd(block, 0);
    const close = /<\/header\s*>/i.exec(block.slice(innerStart));
    if (close) chunks.push(block.slice(innerStart, innerStart + close.index));
    pos = w.end;
  }
  return chunks.join("\n");
}

/** Strip tags + collapse whitespace voor een grove “tekstdichtheid”-check. */
export function approximateVisibleTextLen(html: string): number {
  const stripped = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ");
  const noTags = stripped.replace(/<[^>]+>/g, " ");
  return noTags.replace(/\s+/g, " ").trim().length;
}

export function collectMarketingNavScanHtml(input: {
  sections: readonly { html: string }[];
  marketingPages?: Record<string, readonly { html: string }[]> | null;
  contactSections?: readonly { html: string }[] | null;
}): string {
  const parts: string[] = [];
  for (const s of input.sections) parts.push(s.html);
  if (input.marketingPages) {
    for (const secs of Object.values(input.marketingPages)) {
      for (const s of secs) parts.push(s.html);
    }
  }
  if (input.contactSections) {
    for (const s of input.contactSections) parts.push(s.html);
  }
  return parts.join("\n");
}

export function validateMarketingPageLinks(
  navHtml: string,
  marketingPages: Record<string, unknown>,
): { valid: boolean; missingKeys: string[] } {
  const pageKeys = new Set(Object.keys(marketingPages));
  const navKeys: string[] = [];
  const re = new RegExp(STUDIO_SITE_BASE_SUBPATH_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(navHtml)) !== null) {
    const k = m[1]?.trim().toLowerCase();
    if (k) navKeys.push(k);
  }
  const missingKeys = [...new Set(navKeys)].filter((k) => !pageKeys.has(k));
  return { valid: missingKeys.length === 0, missingKeys };
}

export function validateMarketingPagePlanNavCoverage(
  marketingPages: Record<string, unknown>,
  navHtml: string,
): { valid: boolean; missingInNav: string[] } {
  /** `faq` staat in de footer, niet in de topnav — daarom niet verplicht in deze dekking. */
  const expected = Object.keys(marketingPages).filter((k) => k.trim().toLowerCase() !== "faq");
  const present = new Set<string>();
  const re = new RegExp(STUDIO_SITE_BASE_SUBPATH_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(navHtml)) !== null) {
    const k = m[1]?.trim().toLowerCase();
    if (k) present.add(k);
  }
  const missingInNav = expected.filter((k) => !present.has(k.trim().toLowerCase()));
  return { valid: missingInNav.length === 0, missingInNav };
}

/**
 * FAQ hoort via de footer (buiten `<header>`), niet in de primaire topnav.
 * Vereist wel ergens een link naar `__STUDIO_SITE_BASE__/faq` wanneer `marketingPages` een `faq`-key heeft.
 */
export function validateMarketingFaqLinkNotInHeader(
  marketingPages: Record<string, unknown>,
  fullSiteHtml: string,
): { valid: boolean; error: string | null } {
  const keys = Object.keys(marketingPages).map((k) => k.trim().toLowerCase());
  if (!keys.includes("faq")) return { valid: true, error: null };

  if (!fullSiteHtml.includes(STUDIO_FAQ_PATH)) {
    return {
      valid: false,
      error:
        "Site met FAQ-subpagina mist een link naar __STUDIO_SITE_BASE__/faq (verwacht in de footer op de landingspagina).",
    };
  }

  if (collectHtmlHeaderInnerHtml(fullSiteHtml).includes(STUDIO_FAQ_PATH)) {
    return {
      valid: false,
      error:
        "FAQ-link staat in <header> / topnav — verboden. Zet FAQ alleen in de footer (linkkolom) met href __STUDIO_SITE_BASE__/faq; niet in de hoofdnav.",
    };
  }

  return { valid: true, error: null };
}

/** Inklapbare Q/A op de FAQ-marketingpagina: native `<details>` of Alpine `x-show` + `@click` (na strip van headers). */
export function marketingFaqHtmlHasDisclosurePattern(html: string): boolean {
  const body = stripHtmlHeaderBlocks(html);
  if (/<details\b/i.test(body) && /<summary\b/i.test(body)) return true;
  if (/x-show\s*=\s*["'][^"']*open/i.test(body) && /@click\s*=/i.test(body) && /x-data\s*=/i.test(body)) return true;
  return false;
}

const MIN_SECTIONS_PER_MARKETING_PAGE = 2;
const MIN_VISIBLE_TEXT_PER_PAGE = 280;

export function validateMarketingPageContent(marketingPages: Record<string, MarketingSectionRow[]>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (const [key, sections] of Object.entries(marketingPages)) {
    if (sections.length < MIN_SECTIONS_PER_MARKETING_PAGE) {
      errors.push(
        `${key}: minimaal ${MIN_SECTIONS_PER_MARKETING_PAGE} secties vereist (nu ${sections.length}).`,
      );
    }
    const joined = sections.map((s) => s.html).join(" ");
    const approx = approximateVisibleTextLen(joined);
    if (approx < MIN_VISIBLE_TEXT_PER_PAGE) {
      errors.push(
        `${key}: te weinig zichtbare tekst (~${approx} tekens na strip), minimaal ${MIN_VISIBLE_TEXT_PER_PAGE} vereist.`,
      );
    }
    if (key.trim().toLowerCase() === "faq" && !marketingFaqHtmlHasDisclosurePattern(joined)) {
      errors.push(
        `${key}: vragen moeten klikbaar zijn met zichtbaar antwoord — gebruik per item <details><summary>…</summary><p>…antwoord…</p></details> of Alpine (x-data, @click, x-show) zodat antwoorden uitklappen.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
