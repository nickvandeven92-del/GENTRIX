import { type NextRequest, NextResponse } from "next/server";
import { normalizeRequestHost } from "@/lib/domains/request-host";

/**
 * `NEXT_PUBLIC_PORTAL_HOST=portal.gentrix.nl` → zelfde deployment, host-only URL voor klanten.
 * Rewrite naar interne `/portal/…`-routes (cookies blijven op deze host; zie Supabase cookie-domain docs).
 */
export function maybeRewritePortalHost(request: NextRequest): NextResponse | null {
  const portalHost = process.env.NEXT_PUBLIC_PORTAL_HOST?.trim().toLowerCase();
  if (!portalHost) return null;

  const host = normalizeRequestHost(request.headers.get("host"));
  if (!host || host !== portalHost) return null;

  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return null;
  }
  if (pathname === "/login" || pathname.startsWith("/login/")) return null;
  if (pathname === "/p" || pathname.startsWith("/p/")) return null;
  if (pathname.startsWith("/site/") || pathname === "/site") return null;
  if (pathname.startsWith("/agenda/") || pathname === "/agenda") return null;
  if (
    pathname.startsWith("/boek/") ||
    pathname.startsWith("/booking-app") ||
    pathname.startsWith("/winkel/") ||
    pathname.startsWith("/preview/")
  ) {
    return null;
  }
  if (pathname.startsWith("/portal")) return null;

  const url = request.nextUrl.clone();
  if (pathname === "/" || pathname === "") {
    url.pathname = "/portal";
  } else {
    url.pathname = `/portal${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  }
  return NextResponse.rewrite(url);
}
