import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { filterTailwindSectionsForInactivePublicModules } from "@/lib/site/filter-tailwind-public-modules";
import { PUBLIC_SITE_MODULE_WEBSHOP } from "@/lib/site/public-site-modules-registry";

/**
 * Publieke site: als webshop-module uit staat, geen shop-sectie en geen werkende webshop-placeholders.
 * (Wrapper om het centrale module-register.)
 */
export function filterTailwindSectionsForWebshop(
  sections: TailwindSection[],
  webshopEnabled: boolean,
): TailwindSection[] {
  if (webshopEnabled) return sections;
  return filterTailwindSectionsForInactivePublicModules(sections, new Set([PUBLIC_SITE_MODULE_WEBSHOP]));
}
