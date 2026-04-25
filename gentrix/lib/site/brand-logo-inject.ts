import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";

/** Voorkomt dubbele injectie; zet dit op je eigen merk-wrapper om fallback te onderdrukken. */
export const STUDIO_BRAND_MARK_ATTR = "data-studio-brand-mark";

function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function injectAfterFirstTag(html: string, tagName: string, block: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "i");
  const m = html.match(re);
  if (m == null || m.index === undefined) return null;
  const ins = m.index + m[0].length;
  return html.slice(0, ins) + block + html.slice(ins);
}

/**
 * Als er een opgeslagen `logoSet` is maar de HTML het primary-SVG nog niet bevat,
 * voeg het merkblok toe direct na de eerste `<header>`, anders `<nav>`, anders eerste `<section>`.
 */
export function applyBrandLogoFallbackToSections(
  sections: TailwindSection[],
  logoSet: GeneratedLogoSet | null | undefined,
): TailwindSection[] {
  const primary = logoSet?.variants?.primary?.trim();
  if (!primary || !logoSet) return sections;

  const full = sections.map((s) => s.html).join("\n");
  if (full.includes(STUDIO_BRAND_MARK_ATTR)) return sections;
  /** Model heeft al een “naar home”-link; geen tweede merkblok (tekstlogo + geïnjecteerd SVG). */
  if (/\bhref\s*=\s*(["'])__STUDIO_SITE_BASE__\1/i.test(collapseWs(full))) return sections;

  const pNorm = collapseWs(primary);
  if (pNorm.length >= 16 && collapseWs(full).includes(pNorm)) return sections;

  const brandEsc = escapeHtmlAttr(logoSet.brandName);
  const block = `\n<div class="flex shrink-0 items-center [&_svg]:max-h-8 [&_svg]:w-auto [&_svg]:h-8" ${STUDIO_BRAND_MARK_ATTR}="1"><a href="__STUDIO_SITE_BASE__" class="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 rounded-sm" aria-label="${brandEsc}"><span class="inline-flex h-8 max-w-[min(100%,280px)] items-center">${primary}</span></a></div>\n`;

  const copy = sections.map((s) => ({ ...s, html: s.html }));
  for (const tag of ["header", "nav", "section"] as const) {
    for (let i = 0; i < copy.length; i++) {
      const next = injectAfterFirstTag(copy[i]!.html, tag, block);
      if (next != null) {
        copy[i] = { ...copy[i]!, html: next };
        return copy;
      }
    }
  }

  return sections;
}
