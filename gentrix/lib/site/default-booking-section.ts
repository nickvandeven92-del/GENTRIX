import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  PUBLIC_SITE_MODULE_APPOINTMENTS,
  STUDIO_DATA_ATTR_FEATURE_ZONE,
  STUDIO_DATA_ATTR_MODULE,
} from "@/lib/site/public-site-modules-registry";
import { STUDIO_BOOKING_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/**
 * Canonieke marketing-sectie voor online boeken; `href` gebruikt het studio-placeholdertoken.
 */
export function buildDefaultBookingSection(opts?: { headline?: string }): TailwindSection {
  const headline = opts?.headline?.trim() || "Plan een afspraak";
  return {
    id: "booking",
    sectionName: "Boeken",
    semanticRole: "booking",
    html: `<div id="booking" ${STUDIO_DATA_ATTR_FEATURE_ZONE}="${PUBLIC_SITE_MODULE_APPOINTMENTS}" class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
  <div class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
    <h2 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">${escapeForTextNode(headline)}</h2>
    <p class="mt-2 text-slate-600 dark:text-slate-300">Kies een moment dat past — direct online via onze boekpagina.</p>
    <a href="${STUDIO_BOOKING_PATH_PLACEHOLDER}" ${STUDIO_DATA_ATTR_MODULE}="${PUBLIC_SITE_MODULE_APPOINTMENTS}" class="mt-6 inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">Boek online</a>
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
