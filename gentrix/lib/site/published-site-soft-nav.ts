import { isCandidateForLandingSitePrettyUrl } from "@/lib/domains/reserved-paths";

/**
 * Context voor “SPA-achtige” interne navigatie op gepubliceerde inline-Tailwind-sites
 * (`router.push` + {@link PublishedTailwindInlineClientEffects}).
 */
export type PublishedSiteSoftNavContext = {
  siteSlug: string;
  prettyPublicUrls: boolean;
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function siteBaseVariants(slug: string): string[] {
  const enc = encodeURIComponent(slug);
  if (enc === slug) return [`/site/${slug}`];
  return [`/site/${enc}`, `/site/${slug}`];
}

function previewBaseVariants(slug: string): string[] {
  const enc = encodeURIComponent(slug);
  if (enc === slug) return [`/preview/${slug}`];
  return [`/preview/${enc}`, `/preview/${slug}`];
}

/**
 * `true` wanneer `url` naar een andere pagina binnen **dezelfde** gepubliceerde site wijst
 * (zelfde origin), geschikt voor client-side App Router-navigatie.
 */
export function isPublishedSiteSoftNavTarget(url: URL, ctx: PublishedSiteSoftNavContext): boolean {
  const pathname = normalizePathname(url.pathname);

  if (ctx.prettyPublicUrls) {
    if (pathname === "/") return true;
    if (pathname === "/contact") return true;
    return isCandidateForLandingSitePrettyUrl(url.pathname);
  }

  const bases = siteBaseVariants(ctx.siteSlug.trim());
  for (const b of bases) {
    if (pathname === b) return true;
    if (pathname.startsWith(`${b}/`)) return true;
  }
  const previews = previewBaseVariants(ctx.siteSlug.trim());
  for (const p of previews) {
    if (pathname === p) return true;
    if (pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

/**
 * `true` wanneer we de default browser-actie moeten laten lopen (ankers op dezelfde route).
 */
export function isSameDocumentInPageAnchorNav(url: URL): boolean {
  if (typeof window === "undefined") return false;
  const cur = new URL(window.location.href);
  if (url.origin !== cur.origin) return false;
  if (normalizePathname(url.pathname) !== normalizePathname(cur.pathname)) return false;
  if (url.search !== cur.search) return false;
  return url.hash !== cur.hash;
}
