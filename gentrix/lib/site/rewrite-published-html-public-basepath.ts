/**
 * Herschrijft in de gegenereerde site-HTML alle verwijzingen naar `/site/{slug}/…` en
 * `https://<origin>/site/{slug}/…` naar een “pretty URL” zonder site-prefix
 * (`/…` respectievelijk `https://<origin>/…`).
 *
 * Gebruikt op het primaire studio-domein en op klant-domeinen: daar laat de middleware
 * subpaden (`/werkwijze`, `/contact`, …) intern naar `/site/{slug}/…` wijzen, maar de
 * bezoeker mag die interne route nergens meer zien. Zelfde slug in de href staat gelijk
 * aan “deze site”.
 *
 * We vervangen alleen `href="…"` / `href='…'` attributen; andere `/site/…`-voorkomens
 * (bv. in JSON/data-attributen voor de nav-capture) blijven ongemoeid zodat de bestaande
 * iframe-nav-scripts blijven werken.
 */
export type PrettyPublicUrlRewriteOptions = {
  /**
   * Slug van de landingssite (onversleuteld). We herschrijven `/site/{encodeURIComponent(slug)}` én
   * `/site/{slug}` (voor het geval dat niet-URI-gecodeerde varianten ontstaan).
   */
  slug: string;
  /**
   * Volledige oorsprong (bv. `https://www.gentrix.nl`) voor absolute URL-vervanging. Optioneel:
   * zonder waarde blijven absolute URL’s zoals ze zijn.
   */
  pageOrigin?: string | null;
};

function escapeForRegex(s: string): string {
  return s.replace(/[\\.*+?()^${}|[\]]/g, "\\$&");
}

/**
 * Genereer href-varianten voor de slug (URL-gecodeerd + onbewerkt). Alleen ASCII-safe slugs
 * krijgen we aangeboden in de praktijk; voor veiligheid behandelen we beide.
 */
function slugHrefVariants(slug: string): string[] {
  const enc = encodeURIComponent(slug);
  if (enc === slug) return [slug];
  return [enc, slug];
}

/** Escape dubbele quotes in een URL voor veilige plaatsing binnen een `href="…"`. */
function buildReplacementHrefValue(tail: string): string {
  if (!tail) return "/";
  if (tail.startsWith("/")) return tail;
  return `/${tail}`;
}

/**
 * Vervangt `href` attributen die naar `/site/{slug}(/…)` wijzen door de pretty-URL variant.
 *
 * Voorbeelden:
 * - `href="/site/home/werkwijze"` → `href="/werkwijze"`
 * - `href="/site/home"`           → `href="/"`
 * - `href="/site/home/werkwijze#services"` → `href="/werkwijze#services"`
 * - `href="https://www.gentrix.nl/site/home/werkwijze"` → `href="https://www.gentrix.nl/werkwijze"`
 */
export function rewritePublishedHtmlToPrettyPublicUrls(
  html: string,
  options: PrettyPublicUrlRewriteOptions,
): string {
  const slug = options.slug?.trim();
  if (!slug) return html;

  const origin = options.pageOrigin?.trim().replace(/\/+$/, "") ?? "";

  let out = html;
  const variants = slugHrefVariants(slug);

  for (const variant of variants) {
    const v = escapeForRegex(variant);

    // `href="/site/<slug>(<rest>)?"` of met enkele quotes.
    const relativeRe = new RegExp(`(\\shref\\s*=\\s*)(["'])\\/site\\/${v}([\\/?#][^"']*|)\\2`, "gi");
    out = out.replace(relativeRe, (_m, before: string, quote: string, rest: string) => {
      const replacement = buildReplacementHrefValue(rest);
      return `${before}${quote}${replacement}${quote}`;
    });

    if (origin) {
      const originRe = new RegExp(
        `(\\shref\\s*=\\s*)(["'])${escapeForRegex(origin)}\\/site\\/${v}([\\/?#][^"']*|)\\2`,
        "gi",
      );
      out = out.replace(originRe, (_m, before: string, quote: string, rest: string) => {
        const tail = buildReplacementHrefValue(rest);
        return `${before}${quote}${origin}${tail === "/" ? "/" : tail}${quote}`;
      });
    }
  }

  return out;
}
