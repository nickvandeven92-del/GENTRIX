import type {
  LayoutBiasStrength,
  ResolverConfidenceLayoutOptions,
} from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import type { CompositionConflictDecision } from "@/lib/ai/resolve-composition-plan";
import type { DesignRegime, HeroExpression, SiteIntent } from "@/lib/ai/site-experience-model";

/**
 * Machine-leesbare samenvatting per generatie-run (opslaan naast run-id aanbevolen).
 * Wordt gebouwd na `resolveCompositionPlan` — geen extra interpretatielaag.
 */
export type CompositionDecisionTrace = {
  finalDesignRegime: DesignRegime;
  heroExpression: HeroExpression;
  resolverConfidence: { level: string; score: number } | null;
  experienceModel: string;
  selectedAboveFoldArchetypeId: string | null;
  narrowingMode: LayoutBiasStrength;
  compactPromptUsed: boolean;
  /** Welk signaal won vs wat werd onderdrukt (geen “middeling”, wel dominantie). */
  conflictDecisions: CompositionConflictDecision[];
  /** Afgeleid: onderdrukte alternatieven (archetypen/signalen). */
  topSuppressedAlternatives: string[];
  /** Heuristiek: mogelijke over-neutralisatie. */
  blandnessWarning?: string;
};

const SAFE_ARCHETYPE_CLUSTER = new Set([
  "minimal_statement",
  "service_conversational",
  "editorial_full_bleed",
]);

/**
 * Waarschuwing als soft confidence + veilige archetype-cluster + weinig spanning in expressie samenkomen.
 */
export function assessCompositionBlandnessRisk(input: {
  biasStrength: LayoutBiasStrength;
  effectiveHeroExpression: HeroExpression;
  aboveFoldArchetypeId?: string | null;
  conflictDecisionCount: number;
}): string | undefined {
  const arch = input.aboveFoldArchetypeId ?? "";
  if (input.biasStrength !== "soft") return undefined;
  if (!SAFE_ARCHETYPE_CLUSTER.has(arch)) return undefined;

  if (input.effectiveHeroExpression === "balanced_mixed") {
    return "composition_may_be_overly_neutralized: soft_narrowing + balanced_mixed + safe_archetype_cluster — controleer of bewuste spanning ontbreekt";
  }
  if (input.conflictDecisionCount >= 2) {
    return "composition_may_be_overly_neutralized: soft_narrowing + multiple_conflict_suppressions + safe_archetype_cluster — controleer of premium tension niet weggepolijst is";
  }
  return undefined;
}

export function buildCompositionDecisionTrace(input: {
  normalizedSiteIntent: SiteIntent;
  layoutOptions: ResolverConfidenceLayoutOptions;
  finalDesignRegime: DesignRegime;
  effectiveHeroExpression: HeroExpression;
  conflictDecisions: CompositionConflictDecision[];
  compactPromptUsed: boolean;
}): CompositionDecisionTrace {
  const rc = input.normalizedSiteIntent.resolverConfidence;
  const suppressed = input.conflictDecisions.map((d) => d.suppressedSignal);
  const blandnessWarning = assessCompositionBlandnessRisk({
    biasStrength: input.layoutOptions.biasStrength,
    effectiveHeroExpression: input.effectiveHeroExpression,
    aboveFoldArchetypeId: input.normalizedSiteIntent.aboveFoldArchetypeId,
    conflictDecisionCount: input.conflictDecisions.length,
  });

  return {
    finalDesignRegime: input.finalDesignRegime,
    heroExpression: input.effectiveHeroExpression,
    resolverConfidence: rc ? { level: rc.level, score: rc.score } : null,
    experienceModel: input.normalizedSiteIntent.experienceModel,
    selectedAboveFoldArchetypeId: input.normalizedSiteIntent.aboveFoldArchetypeId ?? null,
    narrowingMode: input.layoutOptions.biasStrength,
    compactPromptUsed: input.compactPromptUsed,
    conflictDecisions: [...input.conflictDecisions],
    topSuppressedAlternatives: suppressed.slice(0, 8),
    ...(blandnessWarning ? { blandnessWarning } : {}),
  };
}
