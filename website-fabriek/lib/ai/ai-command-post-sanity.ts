import type { SiteAiCommandId } from "@/lib/ai/site-ai-commands";
import type { ProjectSnapshot } from "@/lib/site/project-snapshot-schema";

/**
 * **Pre-merge:** minimaal contract op de **basis-snapshot** vóór we Claude’s patch mergen.
 * Voorkomt dat we tokens uitgeven om nadien pas te ontdekken dat het commando op deze pagina niet zinvol is.
 */
export function assertAiCommandPreMergeContract(
  command: SiteAiCommandId,
  base: ProjectSnapshot,
): { ok: true } | { ok: false; error: string } {
  switch (command) {
    case "sharpen_primary_cta": {
      if (!base.sections.some((s) => s.semanticRole === "cta")) {
        return {
          ok: false,
          error: "sharpen_primary_cta: geen sectie met semanticRole \"cta\" in de huidige snapshot.",
        };
      }
      return { ok: true };
    }
    case "tone_luxury_hero":
    case "simplify_mobile_layout": {
      if (base.sections.length < 1) {
        return { ok: false, error: `${command}: snapshot heeft geen secties.` };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

/**
 * **Post-merge:** lichte command-specifieke checks op het resultaat (aanvulling op invarianten).
 */
export function assertAiCommandPostSanity(
  command: SiteAiCommandId,
  before: ProjectSnapshot,
  after: ProjectSnapshot,
): { ok: true } | { ok: false; error: string } {
  switch (command) {
    case "simplify_mobile_layout": {
      if (after.sections.length !== before.sections.length) {
        return {
          ok: false,
          error: "simplify_mobile_layout: aantal secties mag niet wijzigen.",
        };
      }
      for (const s of after.sections) {
        if (s.html.trim().length < 1) {
          return {
            ok: false,
            error: `simplify_mobile_layout: sectie "${s.id}" heeft lege html na merge.`,
          };
        }
      }
      return { ok: true };
    }
    case "tone_luxury_hero": {
      if (after.sections.length < before.sections.length) {
        return {
          ok: false,
          error: "tone_luxury_hero: secties mogen niet verwijderd worden via dit commando.",
        };
      }
      const hero = after.sections.find((s) => s.semanticRole === "hero");
      if (hero != null && hero.html.trim().length < 10) {
        return {
          ok: false,
          error: "tone_luxury_hero: hero-sectie heeft te weinig inhoud na aanpassing.",
        };
      }
      return { ok: true };
    }
    case "sharpen_primary_cta": {
      const ctaIdx = after.sections.findIndex((s) => s.semanticRole === "cta");
      if (ctaIdx < 0) {
        return {
          ok: false,
          error: "sharpen_primary_cta: geen sectie met semanticRole \"cta\" in resultaat.",
        };
      }
      const cta = after.sections[ctaIdx];
      if (cta.html.trim().length < 20) {
        return {
          ok: false,
          error: "sharpen_primary_cta: CTA-sectie html is te kort of leeg.",
        };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}
