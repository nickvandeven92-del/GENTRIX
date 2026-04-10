import { PUBLIC_SITE_MODULE_DEFINITIONS } from "@/lib/site/public-site-modules-registry";

/** Ondersteunde blueprint-id’s (uitbreidbaar; generator kiest default). */
export const SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE = "studio_marketing_single_page" as const;

export type SiteBlueprintId = string;

export type SiteBlueprintModuleSlot = {
  slot: "before_footer" | "after_hero" | "primary_nav_actions";
  moduleId: string;
  intent: "canonical_section" | "embedded_fragment";
};

export type SiteBlueprintDefinition = {
  id: SiteBlueprintId;
  /** Korte naam voor admin / logs. */
  label: string;
  /** Standaard publieke module-slots voor deze blueprint (CRM bepaalt nog of ze renderen). */
  defaultModuleSlots: () => readonly SiteBlueprintModuleSlot[];
};

function defaultPublicModuleSlots(): readonly SiteBlueprintModuleSlot[] {
  return PUBLIC_SITE_MODULE_DEFINITIONS.map((m) => ({
    slot: "before_footer" as const,
    moduleId: m.id,
    intent: "canonical_section" as const,
  }));
}

const BLUEPRINTS: readonly SiteBlueprintDefinition[] = [
  {
    id: SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE,
    label: "Studio — één marketing-landingspagina + canonieke module-slots",
    defaultModuleSlots: defaultPublicModuleSlots,
  },
] as const;

const BLUEPRINT_BY_ID = new Map<string, SiteBlueprintDefinition>(BLUEPRINTS.map((b) => [b.id, b]));

export function getSiteBlueprintDefinition(id: string): SiteBlueprintDefinition | undefined {
  return BLUEPRINT_BY_ID.get(id);
}

export function resolveSiteBlueprintId(id: string | null | undefined): SiteBlueprintDefinition {
  const trimmed = id?.trim();
  if (trimmed && BLUEPRINT_BY_ID.has(trimmed)) {
    return BLUEPRINT_BY_ID.get(trimmed)!;
  }
  return BLUEPRINT_BY_ID.get(SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE)!;
}
