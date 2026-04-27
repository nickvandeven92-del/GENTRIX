import { GENTRIX_DATA_ATTR_ANALYTICS, publicAnalyticsKeyFromToken } from "@/lib/analytics/gentrix-site-data-attrs";

/**
 * Vóór strip van `data-studio-*` compose-attributen: stabiele `data-analytics` voor first-party events.
 * Wordt **niet** door strip geraakt en blijft in bezoekers-HTML.
 */
export function ensurePublicSiteAnalyticsDataAttributesOnHtml(html: string): string {
  let h = tagAnchorsForStudioModule(html, "a");
  h = tagAnchorsForStudioModule(h, "button");
  return h;
}

function tagAnchorsForStudioModule(html: string, tag: "a" | "button"): string {
  const re = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
  return html.replace(re, (full, inner: string) => {
    if (/\bdata-analytics\s*=/i.test(inner)) return full;
    const mod = inner.match(/\bdata-studio-module\s*=\s*(["'])([^"']*)\1/i);
    if (mod?.[2]) {
      const key = publicAnalyticsKeyFromToken("module", mod[2]);
      return `<${tag} ${GENTRIX_DATA_ATTR_ANALYTICS}="${key}"${inner}>`;
    }
    const cta = inner.match(/\bdata-studio-module-cta\s*=\s*(["'])([^"']*)\1/i);
    if (cta?.[2]) {
      const key = publicAnalyticsKeyFromToken("module_cta", cta[2]);
      return `<${tag} ${GENTRIX_DATA_ATTR_ANALYTICS}="${key}"${inner}>`;
    }
    const navm = inner.match(/\bdata-studio-nav-module\s*=\s*(["'])([^"']*)\1/i);
    if (navm?.[2]) {
      const key = publicAnalyticsKeyFromToken("nav_module", navm[2]);
      return `<${tag} ${GENTRIX_DATA_ATTR_ANALYTICS}="${key}"${inner}>`;
    }
    return full;
  });
}
