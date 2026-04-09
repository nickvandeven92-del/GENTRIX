/**
 * Vaste interne AI-acties (geen vrije chat) — basis voor latere self-serve command API.
 */
export const SITE_AI_COMMAND_IDS = ["tone_luxury_hero", "simplify_mobile_layout", "sharpen_primary_cta"] as const;

export type SiteAiCommandId = (typeof SITE_AI_COMMAND_IDS)[number];

export function instructionForSiteAiCommand(id: SiteAiCommandId): string {
  switch (id) {
    case "tone_luxury_hero":
      return `Doel: **hero** (eerste content-sectie / semanticRole "hero") **luxe / high-end**. Werk bij voorkeur via theme (bijv. vibe luxury in pageConfig), theme.tokenOverrides, composition, en sectionUpdates met de juiste **sectionId** uit de snapshot + semanticRole "hero" + copyIntent — gebruik html alleen als nodig voor zichtbare copy/opmaak. Behoud id's/ankers en merkfeiten.`;
    case "simplify_mobile_layout":
      return `Doel: pagina **rustiger op mobiel**. Zet composition.contentDensity op "relaxed" of "generous", voeg theme.tokenOverrides toe (bijv. layout.mobile), en gebruik sectionUpdates met copyIntent waar nodig; pas html alleen aan voor responsive Tailwind (sm:) waar side-by-side te krap is.`;
    case "sharpen_primary_cta":
      return `Doel: **primair CTA** scherper en converterender. Werk via theme.tokenOverrides (cta.intent), sectionUpdates op CTA-secties (semanticRole "cta", copyIntent), en zo nodig html voor knoptekst/contrast — geen spammy taal.`;
    default: {
      const _x: never = id;
      return _x;
    }
  }
}

export const SITE_AI_COMMAND_LABELS: Record<SiteAiCommandId, string> = {
  tone_luxury_hero: "Hero luxer",
  simplify_mobile_layout: "Mobiel rustiger",
  sharpen_primary_cta: "CTA scherper",
};
