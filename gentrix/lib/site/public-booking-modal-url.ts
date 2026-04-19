/**
 * Normaliseert navigatie-URL's (uit marketing-iframe) naar het iframe-src-pad van de boek-SPA.
 * Alleen zelfde-origin paden; anders `null` (bv. winkel of extern).
 */
export function publicBookingIframeSrcFromNavHref(href: string, pageOrigin: string): string | null {
  try {
    const baseOrigin = new URL(pageOrigin).origin;
    const u = new URL(href, pageOrigin);
    if (u.origin !== baseOrigin) return null;
    const p = u.pathname;
    if (p === "/booking-app/book" || p.startsWith("/booking-app/book/")) {
      return `${u.origin}${u.pathname}${u.search}${u.hash}`;
    }
    if (p === "/boek" || p.startsWith("/boek/")) {
      const seg = p.slice("/boek/".length).split("/")[0] ?? "";
      const slug = decodeURIComponent(seg);
      if (!slug) return null;
      return `${u.origin}/booking-app/book/${encodeURIComponent(slug)}${u.search}${u.hash}`;
    }
    if (p === "/boek-venster" || p.startsWith("/boek-venster/")) {
      const seg = p.slice("/boek-venster/".length).split("/")[0] ?? "";
      const slug = decodeURIComponent(seg);
      if (!slug) return null;
      return `${u.origin}/booking-app/book/${encodeURIComponent(slug)}${u.search}${u.hash}`;
    }
    return null;
  } catch {
    return null;
  }
}
