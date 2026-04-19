import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  inactivePublicSiteModuleIds,
  PUBLIC_SITE_MODULE_DEFINITIONS,
  type PublicSiteModuleFlags,
  type PublicSiteModuleId,
} from "@/lib/site/public-site-modules-registry";

/**
 * Verwijdert canonieke module-secties voor **inactieve** modules (CRM).
 * `__STUDIO_BOOKING_PATH__` / `__STUDIO_SHOP_PATH__` blijven in overgebleven HTML staan — resolvers zetten ze
 * altijd om naar `/booking-app/book/…` en `/winkel/…`; inactive-state is een pagina, geen `href="#"`.
 */
export function filterTailwindSectionsForInactivePublicModules(
  sections: TailwindSection[],
  inactiveModuleIds: ReadonlySet<PublicSiteModuleId>,
): TailwindSection[] {
  if (inactiveModuleIds.size === 0) return sections;

  const defs = PUBLIC_SITE_MODULE_DEFINITIONS.filter((d) => inactiveModuleIds.has(d.id));
  const sectionIdsToRemove = new Set<string>();
  for (const d of defs) {
    if (d.renderWhenInactive === "omit_canonical_sections") {
      for (const sid of d.canonicalSectionIds) sectionIdsToRemove.add(sid);
    }
  }

  return sections.filter((s) => !sectionIdsToRemove.has(s.id ?? ""));
}

/** Volledige CRM-flags → één filterstap (geen losse appointments/webshop-takken in compose). */
export function filterTailwindSectionsForPublicSiteModuleFlags(
  sections: TailwindSection[],
  flags: PublicSiteModuleFlags,
): TailwindSection[] {
  return filterTailwindSectionsForInactivePublicModules(sections, inactivePublicSiteModuleIds(flags));
}
