import { type NextRequest, NextResponse } from "next/server";
import { getSlugByCustomDomain } from "@/lib/data/get-slug-by-custom-domain";
import { isCandidateForLandingSitePrettyUrl, isReservedTopLevelPath } from "@/lib/domains/reserved-paths";
import { normalizeRequestHost, shouldResolveCustomDomain } from "@/lib/domains/request-host";
import {
  PRETTY_URL_BASE_PATH_HEADER,
  PRETTY_URL_HOST_HEADER,
} from "@/lib/supabase/middleware-primary-landing";

/**
 * Bezoekers op het domein van de klant zien `https://www.klant.nl/` én `https://www.klant.nl/werkwijze`
 * — niet de interne `/site/{slug}/...`-route. Intern rewrite naar de `/site/[slug]`-subtree.
 *
 * Subpaden buiten de landingssite (`/boek/...`, `/winkel/...`, app-shell) laten we ongemoeid zodat bestaande
 * features op het klantdomein blijven werken.
 */
export async function maybeRewriteCustomDomain(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api")) {
    return null;
  }
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/home") ||
    pathname.startsWith("/portal")
  ) {
    return null;
  }

  const host = normalizeRequestHost(request.headers.get("host"));
  if (!host || !shouldResolveCustomDomain(host)) {
    return null;
  }

  const slug = await getSlugByCustomDomain(host);
  if (!slug) {
    return null;
  }

  const encSlug = encodeURIComponent(slug);
  const basePathPrefix = `/site/${encSlug}`;

  // Root → landingssite.
  if (pathname === "/" || pathname === "") {
    const url = request.nextUrl.clone();
    url.pathname = basePathPrefix;
    return NextResponse.rewrite(url, {
      request: { headers: withPrettyUrlHeaders(request, basePathPrefix) },
    });
  }

  // Directe interne route (`/site/...`) op een klantdomein: vertaal terug naar pretty URL.
  if (pathname === basePathPrefix || pathname.startsWith(`${basePathPrefix}/`)) {
    const canonical = canonicalizePrettyUrlFromSitePath(pathname, basePathPrefix);
    if (canonical != null && canonical !== pathname) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = canonical;
      return NextResponse.redirect(redirectUrl, 308);
    }
    return null;
  }

  // Subpad (`/werkwijze`, `/contact`, …) op klantdomein → rewrite naar `/site/{slug}/seg`.
  if (isCandidateForLandingSitePrettyUrl(pathname)) {
    const seg = pathname.replace(/^\/+|\/+$/g, "");
    const target =
      seg === "contact"
        ? `${basePathPrefix}/contact`
        : `${basePathPrefix}/${encodeURIComponent(decodeSafe(seg))}`;

    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url, {
      request: { headers: withPrettyUrlHeaders(request, basePathPrefix) },
    });
  }

  // Gereserveerde top-level paden (`/boek/...`, `/winkel/...`, statics): niet aanraken.
  if (isReservedTopLevelPath(pathname)) {
    return null;
  }

  // Alles wat overblijft (meerdere segmenten die géén site-subpagina zijn): terug naar home.
  return NextResponse.redirect(new URL("/", request.url));
}

function withPrettyUrlHeaders(request: NextRequest, basePathPrefix: string): Headers {
  const forwarded = new Headers(request.headers);
  forwarded.set(PRETTY_URL_HOST_HEADER, "1");
  forwarded.set(PRETTY_URL_BASE_PATH_HEADER, basePathPrefix);
  return forwarded;
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function canonicalizePrettyUrlFromSitePath(pathname: string, basePathPrefix: string): string | null {
  if (pathname === basePathPrefix) return "/";
  const tail = pathname.slice(basePathPrefix.length);
  if (!tail.startsWith("/")) return null;
  const rest = tail.replace(/^\/+|\/+$/g, "");
  if (!rest) return "/";
  const parts = rest.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const seg = parts[0]!;
  const segNorm = decodeSafe(seg).toLowerCase();
  if (segNorm === "contact") return "/contact";
  return `/${seg}`;
}
