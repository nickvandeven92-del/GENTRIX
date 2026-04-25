/**
 * Publieke Tailwind-shell: lettertypen in `<head>`.
 * — **Inter** als eerste familie: zelf-gehoste variable woff2 (NL: latin + latin-ext), geen Google.
 * — **Andere** eerste webfont: uitgestelde Google Fonts-css (vrije keuze in generator).
 */

const GENERIC_FIRST_FAMILIES = new Set(
  ["system-ui", "ui-sans-serif", "ui-serif", "inherit", "default", "serif", "sans-serif", "monospace"].map((s) =>
    s.toLowerCase(),
  ),
);

const INTER_LATIN_WOFF2 = "/fonts/inter-latin-wght-normal.woff2";
const INTER_LATIN_EXT_WOFF2 = "/fonts/inter-latin-ext-wght-normal.woff2";

/** Zelfde unicode-ranges als `@fontsource-variable/inter` `wght.css` (subset NL + EU). */
const INTER_UNICODE_LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const INTER_UNICODE_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

function escapeAttrHref(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function extractFirstWebfontFamilyFromStack(fontStack: string): string | null {
  const s = fontStack.trim();
  if (!s) return null;
  const first = s.split(",")[0]!.trim().replace(/^["'`]|["'`]$/g, "");
  if (!first) return null;
  if (GENERIC_FIRST_FAMILIES.has(first.toLowerCase())) return null;
  return first;
}

export function googleFontsStylesheetHrefForStack(fontStack: string): string | null {
  const first = extractFirstWebfontFamilyFromStack(fontStack);
  if (!first) return null;
  const param = encodeURIComponent(first).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${param}:wght@400;500;600;700;800&display=swap`;
}

export function isBundledSelfHostedInterPrimary(firstFamily: string | null): boolean {
  return firstFamily != null && firstFamily.length > 0 && /^Inter$/i.test(firstFamily);
}

/**
 * Google Fonts `stylesheet` blokkeert eerste paint; `media="print"` + `onload` activeert asynchroon.
 */
export function buildDeferredFontStylesheetLinks(fontHref: string): string {
  const h = escapeAttrHref(fontHref);
  return `  <link href="${h}" rel="stylesheet" media="print" onload="this.media='all'"/>
  <noscript><link href="${h}" rel="stylesheet"/></noscript>`;
}

export function buildGoogleWebfontHeadFragment(googleCssHref: string): string {
  return `  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link rel="dns-prefetch" href="https://fonts.googleapis.com"/>
${buildDeferredFontStylesheetLinks(googleCssHref)}`;
}

export function buildSelfHostedInterFontHeadFragment(): string {
  const lat = escapeAttrHref(INTER_LATIN_WOFF2);
  const ext = escapeAttrHref(INTER_LATIN_EXT_WOFF2);
  return `  <link rel="preload" href="${lat}" as="font" type="font/woff2" crossorigin/>
  <link rel="preload" href="${ext}" as="font" type="font/woff2" crossorigin/>
  <style>
    @font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:100 900;src:url(${INTER_LATIN_WOFF2}) format("woff2-variations");unicode-range:${INTER_UNICODE_LATIN};}
    @font-face{font-family:Inter;font-style:normal;font-display:swap;font-weight:100 900;src:url(${INTER_LATIN_EXT_WOFF2}) format("woff2-variations");unicode-range:${INTER_UNICODE_LATIN_EXT};}
  </style>`;
}

/**
 * Bepaalt het volledige font-`<head>`-fragment voor studio/preview/export-HTML.
 */
export function buildStudioFontHeadFragment(input: { fontStack: string }): string {
  const first = extractFirstWebfontFamilyFromStack(input.fontStack);
  if (isBundledSelfHostedInterPrimary(first)) {
    return buildSelfHostedInterFontHeadFragment();
  }
  const google = googleFontsStylesheetHrefForStack(input.fontStack);
  if (google) {
    return buildGoogleWebfontHeadFragment(google);
  }
  return "";
}
