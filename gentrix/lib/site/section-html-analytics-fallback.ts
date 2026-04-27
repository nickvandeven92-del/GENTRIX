import { GENTRIX_DATA_ATTR_ANALYTICS } from "@/lib/analytics/gentrix-site-data-attrs";

const PRIORITY_SECTION_IDS = new Set(
  ["hero", "contact", "shop", "booking", "cta", "footer", "nav", "header"].map((s) => s.toLowerCase()),
);

/**
 * Voegt `data-analytics` toe aan `<a>`/`<button>` zonder attribuut binnen bekende secties (hero, contact, …),
 * zodat klikken meetbaar zijn zonder elke AI-pagina handmatig te labelen.
 */
export function addFallbackDataAnalyticsToSectionHtml(
  html: string,
  sectionId: string,
  opts?: { maxTags?: number },
): string {
  const sid = sectionId.trim().slice(0, 64);
  if (!sid) return html;
  if (!PRIORITY_SECTION_IDS.has(sid.toLowerCase()) && !sid.toLowerCase().startsWith("marketing")) {
    return html;
  }
  const max = Math.min(20, Math.max(1, opts?.maxTags ?? 10));
  let n = 0;
  const inject = (input: string, tag: "a" | "button"): string => {
    const re = new RegExp(`<${tag}\\b([^>]*)>`, "gi");
    return input.replace(re, (full, inner: string) => {
      if (/\bdata-analytics\s*=/i.test(inner)) return full;
      if (/\bdata-studio-module\b/i.test(inner) || /\bdata-studio-nav-module\b/i.test(inner)) return full;
      if (n >= max) return full;
      n += 1;
      const key = `section:${sid.replace(/[^a-zA-Z0-9_-]/g, "-")}:btn_${n}`;
      return `<${tag} ${GENTRIX_DATA_ATTR_ANALYTICS}="${key}" data-analytics-section="${sid}"${inner}>`;
    });
  };
  return inject(inject(html, "a"), "button");
}
