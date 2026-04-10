import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_SHOP_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

const PRODUCT_LABELS = ["Uitgelicht 1", "Uitgelicht 2", "Uitgelicht 3", "Uitgelicht 4"] as const;

/**
 * Canonieke marketing-sectie webshop: vier producttegels + CTA; `href` gebruikt het studio-placeholdertoken.
 * (Copy is bewust generiek — klant past titels in de editor aan.)
 */
export function buildDefaultShopSection(opts?: { headline?: string }): TailwindSection {
  const headline = opts?.headline?.trim() || "Producten";
  const cards = PRODUCT_LABELS.map(
    (label) => `
    <article class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
      <div class="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900" aria-hidden="true"></div>
      <div class="flex flex-1 flex-col p-4">
        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-50">${escapeForTextNode(label)}</h3>
        <p class="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-400">Korte omschrijving — pas aan in de editor.</p>
        <p class="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">Prijs op aanvraag</p>
        <a href="${STUDIO_SHOP_PATH_PLACEHOLDER}" class="mt-3 inline-flex items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 transition hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40">Bekijk in webshop</a>
      </div>
    </article>`,
  ).join("");

  return {
    id: "shop",
    sectionName: "Producten",
    semanticRole: "shop",
    html: `<div id="shop" class="border-y border-slate-200/80 bg-slate-50/50 py-16 dark:border-slate-800 dark:bg-slate-950/40">
  <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-2xl text-center">
      <h2 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">${escapeForTextNode(headline)}</h2>
      <p class="mt-2 text-slate-600 dark:text-slate-300">Vier voorbeeldproducten op je landingspagina — koppel de webshop-module om de catalogus live te tonen.</p>
    </div>
    <div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      ${cards}
    </div>
    <div class="mt-10 flex justify-center">
      <a href="${STUDIO_SHOP_PATH_PLACEHOLDER}" class="inline-flex items-center justify-center rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">Naar de webshop</a>
    </div>
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
