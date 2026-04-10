import {
  STUDIO_BOOKING_PATH_PLACEHOLDER,
  STUDIO_SHOP_PATH_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";

/**
 * Stabiele publieke module-id (CRM + generator + HTML data-attributen).
 * Nieuwe modules: voeg hier één definitie toe; geen hardcoded if/else meer in compose.
 */
export type PublicSiteModuleId = string;

export const PUBLIC_SITE_MODULE_APPOINTMENTS = "appointments";
export const PUBLIC_SITE_MODULE_WEBSHOP = "webshop";

/** Attribuutnamen voor compose (verwijderd uit bezoekers-HTML na publicatie). */
export const STUDIO_DATA_ATTR_MODULE = "data-studio-module";
/** Legacy alias — blijft herkend bij strip en tagging. */
export const STUDIO_DATA_ATTR_MODULE_LINK = "data-studio-module-link";
export const STUDIO_DATA_ATTR_NAV_MODULE = "data-studio-nav-module";
export const STUDIO_DATA_ATTR_MODULE_CTA = "data-studio-module-cta";
export const STUDIO_DATA_ATTR_FEATURE_ZONE = "data-studio-feature-zone";

export type PublicSiteModuleFlags = {
  appointmentsEnabled: boolean;
  webshopEnabled: boolean;
};

export type PublicSiteRouteBehavior = {
  /** Pad op deze app, met URL-gecodeerde subfolder-slug. */
  hrefFromPublishedSlug: (subfolderSlug: string) => string;
};

export type PublicSiteNavBehavior = {
  /** Verwijder `<a>` / `<button>` met `data-studio-nav-module` of module-`href` wanneer module inactief. */
  stripTaggedNavWhenInactive: boolean;
};

export type PublicSitePlacement = "marketing_body" | "canonical_section";

export type PublicSiteRenderWhenInactive =
  /** Secties waarvan `TailwindSection.id` in `canonicalSectionIds` staat, volledig weglaten. */
  | "omit_canonical_sections"
  /** Alleen gelabelde UI (zones, CTAs, nav, module-ankers) strippen — sectie blijft als die geen canoniek id heeft. */
  | "strip_marked_fragments_only";

export type PublicSiteModuleDefinition = {
  id: PublicSiteModuleId;
  /** CRM-veldnaam zoals in `clients` / bundle — één bron per module. */
  crmFlag: keyof Pick<PublicSiteModuleFlags, "appointmentsEnabled" | "webshopEnabled">;
  pathPlaceholder: string;
  route: PublicSiteRouteBehavior;
  nav: PublicSiteNavBehavior;
  /** Waar module-UI in marketing-HTML mag voorkomen (documentatie + toekomstige validators). */
  allowedPlacements: readonly PublicSitePlacement[];
  renderWhenInactive: PublicSiteRenderWhenInactive;
  /** Canonieke sectie-`id`'s die bij inactieve module uit de sectielijst verdwijnen (zoals `booking`, `shop`). */
  canonicalSectionIds: readonly string[];
  strip: {
    featureZones: boolean;
    moduleAnchors: boolean;
    navAnchors: boolean;
    ctaElements: boolean;
  };
};

export const PUBLIC_SITE_MODULE_DEFINITIONS: readonly PublicSiteModuleDefinition[] = [
  {
    id: PUBLIC_SITE_MODULE_APPOINTMENTS,
    crmFlag: "appointmentsEnabled",
    pathPlaceholder: STUDIO_BOOKING_PATH_PLACEHOLDER,
    route: {
      hrefFromPublishedSlug: (slug) => `/boek/${encodeURIComponent(slug)}`,
    },
    nav: { stripTaggedNavWhenInactive: true },
    allowedPlacements: ["marketing_body", "canonical_section"],
    renderWhenInactive: "omit_canonical_sections",
    canonicalSectionIds: ["booking"],
    strip: {
      featureZones: true,
      moduleAnchors: true,
      navAnchors: true,
      ctaElements: true,
    },
  },
  {
    id: PUBLIC_SITE_MODULE_WEBSHOP,
    crmFlag: "webshopEnabled",
    pathPlaceholder: STUDIO_SHOP_PATH_PLACEHOLDER,
    route: {
      hrefFromPublishedSlug: (slug) => `/winkel/${encodeURIComponent(slug)}`,
    },
    nav: { stripTaggedNavWhenInactive: true },
    allowedPlacements: ["marketing_body", "canonical_section"],
    renderWhenInactive: "omit_canonical_sections",
    canonicalSectionIds: ["shop"],
    strip: {
      featureZones: true,
      moduleAnchors: true,
      navAnchors: true,
      ctaElements: true,
    },
  },
] as const;

export function getPublicSiteModuleDefinition(
  id: PublicSiteModuleId,
): PublicSiteModuleDefinition | undefined {
  return PUBLIC_SITE_MODULE_DEFINITIONS.find((m) => m.id === id);
}

/** Module-id's die volgens CRM **uit** staan op de publieke marketingpagina. */
export function inactivePublicSiteModuleIds(flags: PublicSiteModuleFlags): Set<PublicSiteModuleId> {
  const inactive = new Set<PublicSiteModuleId>();
  for (const def of PUBLIC_SITE_MODULE_DEFINITIONS) {
    if (!flags[def.crmFlag]) inactive.add(def.id);
  }
  return inactive;
}
