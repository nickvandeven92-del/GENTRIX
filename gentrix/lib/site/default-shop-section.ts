import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

/**
 * Fallback shop-blok wanneer de site nog geen `id: "shop"`-sectie heeft;
 * zelfde patronen als `default-booking-section` (Tailwind + dark).
 */
export function buildDefaultShopSection(opts?: { headline?: string }): TailwindSection {
  const headline = opts?.headline?.trim() || "Webshop";
  return {
    id: "shop",
    sectionName: "Webshop",
    semanticRole: "shop",
    html: `<div id="shop" class="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 sm:py-16">
  <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
    <h2 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">${escapeForTextNode(headline)}</h2>
    <p class="mt-2 text-slate-600 dark:text-slate-300">Bestel direct online — hieronder staat je productcatalogus wanneer die gekoppeld is.</p>
  </div>
</div>`,
  };
}

function escapeForTextNode(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
