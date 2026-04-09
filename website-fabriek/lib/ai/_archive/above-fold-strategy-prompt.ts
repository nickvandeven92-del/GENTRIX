import {
  buildDesignRegimePromptBlock,
  buildHeroCharacterBlock,
  getEffectiveHeroExpression,
} from "@/lib/ai/above-fold-archetypes";
import {
  applyResolverConfidenceToLayoutOptions,
  type ResolverConfidenceLayoutOptions,
} from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import type { SiteConfig } from "@/lib/ai/build-site-config";
import type { CompositionConflictDecision } from "@/lib/ai/resolve-composition-plan";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

function buildResolverStrengthInstruction(layout: ResolverConfidenceLayoutOptions): string {
  if (layout.biasStrength === "hard") {
    return "Sterke **voorkeur** voor het gekozen above-fold-patroon; afwijken mag als briefing of merkstory dat duidelijk sterker maakt (binnen preset + JSON-regels).";
  }
  if (layout.biasStrength === "soft") {
    return "**Zachte hint** — veel vrijheid; archetype en heroExpression zijn inspiratie, geen mal.";
  }
  return "**Voorkeursrichting** — consistent waar het helpt, niet star.";
}

export type BuildAboveFoldStrategyPromptBlockParams = {
  siteIntent: SiteIntent;
  siteConfig: Pick<SiteConfig, "prompt_interpretation_context">;
  layoutOptions?: ResolverConfidenceLayoutOptions;
  conflictsResolved?: string[];
  conflictDecisions?: CompositionConflictDecision[];
};

/**
 * Korte above-fold-laag: regime + hero-karakter + compacte hint. Geen lange interpretatie-json,
 * geen dubbele CONTENT AUTHORITY (die staat al in de hoofd-user-prompt).
 */
export function buildAboveFoldStrategyPromptBlock(params: BuildAboveFoldStrategyPromptBlockParams): string {
  const { siteIntent } = params;
  const layoutOptions =
    params.layoutOptions ?? applyResolverConfidenceToLayoutOptions(siteIntent.resolverConfidence);

  const head: string[] = [
    "=== ABOVE-FOLD (richting, niet micromanagement) ===",
    `- **heroExpression:** ${getEffectiveHeroExpression(siteIntent)}`,
    `- ${buildResolverStrengthInstruction(layoutOptions)}`,
  ];
  if (siteIntent.resolverConfidence) {
    const rc = siteIntent.resolverConfidence;
    head.push(`- resolver: ${rc.level} (${rc.score.toFixed(2)})`);
  }
  if (siteIntent.aboveFoldArchetypeId) {
    head.push(`- **aboveFoldArchetypeId:** ${siteIntent.aboveFoldArchetypeId} (hint)`);
  }
  if (params.conflictDecisions?.length) {
    for (const d of params.conflictDecisions) {
      head.push(`- Compositie: ${d.winningSignal} boven ${d.suppressedSignal} — ${d.reason}`);
    }
  } else if (params.conflictsResolved?.length) {
    head.push(`- Normalisatie: ${params.conflictsResolved.join("; ")}`);
  }

  const detail = `=== Above the fold — compact ===
- **Hero = essentieel:** bezoekers oordelen in seconden; above-the-fold moet **pakkend** zijn (dominant beeld of cinematic oppervlak + sterke typografie), geen “template-lege” opening.
- \`_layout_archetypes.hero\` + design regime hieronder = **orientatie**, geen verplichte mal. Kies wat de briefing en het merk het sterkst maakt binnen preset + JSON-regels.`;

  return [
    ...head,
    "",
    buildDesignRegimePromptBlock(siteIntent),
    "",
    buildHeroCharacterBlock(siteIntent),
    "",
    detail,
  ].join("\n");
}
