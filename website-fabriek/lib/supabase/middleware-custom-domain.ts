import { type NextRequest, NextResponse } from "next/server";
import { getSlugByCustomDomain } from "@/lib/data/get-slug-by-custom-domain";
import { normalizeRequestHost, shouldResolveCustomDomain } from "@/lib/domains/request-host";

/**
 * Bezoekers op het domein van de klant zien https://www.klant.nl/ — niet /site/slug.
 * Intern rewrite naar /site/[slug] (zelfde page als op jouw host).
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

  if (pathname !== "/" && pathname !== "") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = request.nextUrl.clone();
  url.pathname = `/site/${encodeURIComponent(slug)}`;
  return NextResponse.rewrite(url);
}
