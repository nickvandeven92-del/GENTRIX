const STUDIO_SITE_BASE_SUBPATH_RE = /__STUDIO_SITE_BASE__\/([a-z0-9-]+)/gi;

type MarketingSectionRow = { id: string; html: string };

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
  const expected = Object.keys(marketingPages);
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
  }

  return { valid: errors.length === 0, errors };
}
