import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { buildDefaultShopSection } from "@/lib/site/default-shop-section";

/**
 * Bouwt een compacte subpagina voor `/winkel/{slug}`:zelfde header/footer als de marketing-site,
 * plus de gegenereerde shop-sectie (of een nette fallback).
 */
export function buildWebshopPageSections(sections: TailwindSection[]): TailwindSection[] {
  if (sections.length === 0) {
    return [buildDefaultShopSection()];
  }

  const nav =
    sections.find((s) => s.semanticRole === "nav" || s.id === "nav") ?? sections[0];

  const shop =
    sections.find((s) => s.id === "shop" || s.semanticRole === "shop") ?? buildDefaultShopSection();

  const footer =
    [...sections].reverse().find((s) => s.semanticRole === "footer" || s.id === "footer") ??
    (sections.length > 1 ? sections[sections.length - 1] : undefined);

  const out: TailwindSection[] = [nav];
  if (shop !== nav) out.push(shop);
  if (footer && footer !== nav && footer !== shop) out.push(footer);

  return out;
}

function escapeHtmlAttribute(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Voegt een catalogus-iframe toe onder de shop-content (Chameleon e.d.), visueel in lijn met de secties.
 */
export function appendShopCatalogEmbedSection(
  sections: TailwindSection[],
  embedSrcTemplate: string | null | undefined,
  subfolderSlug: string,
): TailwindSection[] {
  const t = embedSrcTemplate?.trim() ?? "";
  if (!t.includes("{slug}")) return sections;

  const enc = encodeURIComponent(subfolderSlug);
  const src = escapeHtmlAttribute(t.replace(/\{slug\}/g, enc));

  const embed: TailwindSection = {
    id: "shop-catalog-embed",
    sectionName: "Catalogus",
    semanticRole: "generic",
    html: `<div id="shop-catalog" class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
  <p class="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Producten</p>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
    <iframe title="Productcatalogus" src="${src}" class="h-[min(85vh,920px)] w-full border-0 bg-white dark:bg-slate-950" loading="lazy"></iframe>
  </div>
</div>`,
  };

  return [...sections, embed];
}
