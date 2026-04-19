import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  PUBLIC_SITE_MODULE_APPOINTMENTS,
  STUDIO_DATA_ATTR_FEATURE_ZONE,
} from "@/lib/site/public-site-modules-registry";

/**
 * Canonieke `id: "booking"`-sectie voor CRM/module-strip: geen tweede CTA-kaart.
 * De echte boek-actie hoort in header/nav met `href="__STUDIO_BOOKING_PATH__"` (preset add-booking / studio-briefing);
 * die links krijgen `data-studio-module` bij compose. Dit blok is alleen een licht anker vóór de footer.
 */
export function buildDefaultBookingSection(_opts?: { headline?: string }): TailwindSection {
  return {
    id: "booking",
    sectionName: "Boeken",
    semanticRole: "booking",
    html: `<div id="booking" ${STUDIO_DATA_ATTR_FEATURE_ZONE}="${PUBLIC_SITE_MODULE_APPOINTMENTS}" class="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
  <div class="h-px w-full bg-slate-200/90 dark:bg-slate-600/80" aria-hidden="true"></div>
</div>`,
  };
}
