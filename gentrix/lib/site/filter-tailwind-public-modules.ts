import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  inactivePublicSiteModuleIds,
  PUBLIC_SITE_MODULE_DEFINITIONS,
  type PublicSiteModuleFlags,
  type PublicSiteModuleId,
} from "@/lib/site/public-site-modules-registry";

/**
 * Verwijdert canonieke module-secties en neutraliseert pad-placeholders voor **inactieve** modules
 * volgens het centrale register.
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

  const withoutSections = sections.filter((s) => !sectionIdsToRemove.has(s.id ?? ""));

  return withoutSections.map((s) => {
    let html = s.html;
    for (const d of defs) {
      html = html.split(d.pathPlaceholder).join("#");
    }
    return { ...s, html };
  });
}

/** Volledige CRM-flags → één filterstap (geen losse appointments/webshop-takken in compose). */
export function filterTailwindSectionsForPublicSiteModuleFlags(
  sections: TailwindSection[],
  flags: PublicSiteModuleFlags,
): TailwindSection[] {
  return filterTailwindSectionsForInactivePublicModules(sections, inactivePublicSiteModuleIds(flags));
}
