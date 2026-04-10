import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { filterTailwindSectionsForInactivePublicModules } from "@/lib/site/filter-tailwind-public-modules";
import { PUBLIC_SITE_MODULE_APPOINTMENTS } from "@/lib/site/public-site-modules-registry";

/**
 * Publieke site: als afspraken-module uit staat, geen booking-sectie en geen werkende boek-placeholders.
 * (Wrapper om het centrale module-register — bestaande call-sites blijven werken.)
 */
export function filterTailwindSectionsForAppointments(
  sections: TailwindSection[],
  appointmentsEnabled: boolean,
): TailwindSection[] {
  if (appointmentsEnabled) return sections;
  return filterTailwindSectionsForInactivePublicModules(
    sections,
    new Set([PUBLIC_SITE_MODULE_APPOINTMENTS]),
  );
}
