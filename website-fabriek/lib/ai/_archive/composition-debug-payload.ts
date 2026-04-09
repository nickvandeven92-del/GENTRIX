import type { SiteIntent } from "@/lib/ai/site-experience-model";
import type { ResolverConfidenceLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import type { PageCompositionBias } from "@/lib/ai/page-composition-bias";
import {
  CONTENT_AUTHORITY_POLICY_VERSION,
  getContentAuthorityRulesSummary,
} from "@/lib/ai/content-authority-policy";
import type { CompositionDecisionTrace } from "@/lib/ai/composition-decision-trace";
import type { CompositionConflictDecision } from "@/lib/ai/resolve-composition-plan";

export type CompositionDebugPayload = {
  siteIntent: {
    experienceModel?: string;
    designRegime?: string;
    heroExpression?: string;
    aboveFoldArchetypeId?: string;
    resolverConfidence?: {
      level?: string;
      score?: number;
    };
  };
  layoutOptions: ResolverConfidenceLayoutOptions;
  pageCompositionBias: {
    featuresDensity: string;
    featurePreferredTags: string[];
    featureDiscouragedTags: string[];
    proofStyle: string;
    proofPreferredTags: string[];
    proofDiscouragedTags: string[];
    ctaIntensity: string;
    ctaPreferredTags: string[];
    ctaDiscouragedTags: string[];
    rhythmMode: string;
    discourageRepeatingCards: boolean;
    discourageEarlyPricing: boolean;
    preferVisualContinuation: boolean;
    antiPatterns: string[];
  };
  conflictsResolved: string[];
  /** Wie won t.o.v. wie (dominantie, geen middeling). */
  conflictDecisions?: CompositionConflictDecision[];
  /** Korte machine-leesbare trace voor runs/snapshots. */
  decisionTrace?: CompositionDecisionTrace;
  poolDebug?: {
    heroPoolBefore?: string[];
    heroPoolAfter?: string[];
    featurePoolBefore?: string[];
    featurePoolAfter?: string[];
    proofPoolBefore?: string[];
    proofPoolAfter?: string[];
    ctaPoolBefore?: string[];
    ctaPoolAfter?: string[];
  };
  /** Welke anti-hallucinatieregels actief waren (policy + samenvatting). */
  contentAuthority?: {
    policyVersion: string;
    rulesSummary: readonly string[];
  };
};

export function buildCompositionDebugPayload(input: {
  siteIntent: SiteIntent;
  layoutOptions: ResolverConfidenceLayoutOptions;
  pageCompositionBias: PageCompositionBias;
  conflictsResolved?: string[];
  conflictDecisions?: CompositionConflictDecision[];
  decisionTrace?: CompositionDecisionTrace;
  poolDebug?: CompositionDebugPayload["poolDebug"];
  /** Standaard aan: zelfde regels als in prompts. Zet op false om uit debug-JSON te laten. */
  includeContentAuthority?: boolean;
}): CompositionDebugPayload {
  const si = input.siteIntent;
  const includeCa = input.includeContentAuthority !== false;
  return {
    siteIntent: {
      experienceModel: si.experienceModel,
      designRegime: si.designRegime,
      heroExpression: si.heroExpression,
      aboveFoldArchetypeId: si.aboveFoldArchetypeId,
      resolverConfidence: si.resolverConfidence
        ? { level: si.resolverConfidence.level, score: si.resolverConfidence.score }
        : undefined,
    },
    layoutOptions: input.layoutOptions,
    pageCompositionBias: {
      featuresDensity: input.pageCompositionBias.featuresBias.density,
      featurePreferredTags: [...input.pageCompositionBias.featuresBias.preferredTags],
      featureDiscouragedTags: [...input.pageCompositionBias.featuresBias.discouragedTags],
      proofStyle: input.pageCompositionBias.proofBias.style,
      proofPreferredTags: [...input.pageCompositionBias.proofBias.preferredTags],
      proofDiscouragedTags: [...input.pageCompositionBias.proofBias.discouragedTags],
      ctaIntensity: input.pageCompositionBias.ctaBias.intensity,
      ctaPreferredTags: [...input.pageCompositionBias.ctaBias.preferredTags],
      ctaDiscouragedTags: [...input.pageCompositionBias.ctaBias.discouragedTags],
      rhythmMode: input.pageCompositionBias.rhythmBias.mode,
      discourageRepeatingCards: input.pageCompositionBias.rhythmBias.discourageRepeatingCards,
      discourageEarlyPricing: input.pageCompositionBias.rhythmBias.discourageEarlyPricing,
      preferVisualContinuation: input.pageCompositionBias.rhythmBias.preferVisualContinuation,
      antiPatterns: [...input.pageCompositionBias.antiPatterns],
    },
    conflictsResolved: input.conflictsResolved ? [...input.conflictsResolved] : [],
    ...(input.conflictDecisions?.length
      ? { conflictDecisions: [...input.conflictDecisions] }
      : {}),
    ...(input.decisionTrace ? { decisionTrace: { ...input.decisionTrace } } : {}),
    poolDebug: input.poolDebug ? { ...input.poolDebug } : undefined,
    ...(includeCa
      ? {
          contentAuthority: {
            policyVersion: CONTENT_AUTHORITY_POLICY_VERSION,
            rulesSummary: [...getContentAuthorityRulesSummary()],
          },
        }
      : {}),
  };
}
