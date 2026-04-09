import {
  buildUserIntentProfileFromInterpretation,
  buildVisualDesignRegimeFromInterpretation,
} from "@/lib/ai/derive-user-intent-profile";
import { resolveAboveFoldArchetype } from "@/lib/ai/above-fold-plan";
import { ensureSiteIntentDesignRegime, resolveFinalDesignRegime } from "@/lib/ai/above-fold-archetypes";
import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type {
  AboveFoldArchetypeId,
  DesignRegime,
  HeroExpression,
  ResolverConfidence,
  SiteIntent,
} from "@/lib/ai/site-experience-model";

export function mapAboveFoldArchetypeIdToHeroExpression(id: AboveFoldArchetypeId): HeroExpression {
  const m: Record<AboveFoldArchetypeId, HeroExpression> = {
    integrated_campaign_media: "integrated_campaign",
    editorial_full_bleed: "editorial_calm",
    product_split_conversion: "split_clear",
    trust_split_clarity: "split_clear",
    immersive_overlay_statement: "immersive_overlay",
    minimal_statement: "minimal_typographic",
    showcase_media_wall: "showcase_visual",
    dense_commerce_stage: "commerce_dense",
    service_conversational: "service_trust",
  };
  return m[id];
}

export function buildResolverConfidence(interpretation: PromptInterpretation): ResolverConfidence {
  const score = Math.min(1, Math.max(0, interpretation.confidence));
  let level: ResolverConfidence["level"] = "medium";
  if (score < 0.45) level = "low";
  else if (score >= 0.72) level = "high";
  return { level, score };
}

function heroExpressionFromDesignRegime(regime: DesignRegime): HeroExpression {
  if (regime === "hero_split") return "split_clear";
  if (regime === "hero_integrated") return "integrated_hero";
  return "balanced_mixed";
}

/**
 * Vult `heroExpression`, `resolverConfidence` en (bij context) `aboveFoldArchetypeId`.
 * Geen tweede interpretatie — alleen projectie van bestaande `interpretation` + `profile`.
 *
 * Conflicten tussen expressie en archetype worden centraal genormaliseerd in
 * `resolveCompositionPlan` (layout/prompt-pipeline), niet hier — deze helper blijft enrichment/fallbacks.
 */
export function ensureSiteIntentAboveFoldFields(
  intent: SiteIntent,
  ctx?: { interpretation: PromptInterpretation; profile: HeuristicSignalProfile },
): SiteIntent {
  const base = ensureSiteIntentDesignRegime(intent);
  if (ctx) {
    const userProfile = buildUserIntentProfileFromInterpretation(ctx.interpretation, ctx.profile);
    const vRegime = buildVisualDesignRegimeFromInterpretation(
      ctx.interpretation,
      ctx.profile,
      base,
    );
    const { archetype } = resolveAboveFoldArchetype(userProfile, vRegime);
    return {
      ...base,
      heroExpression: mapAboveFoldArchetypeIdToHeroExpression(archetype.id),
      resolverConfidence: buildResolverConfidence(ctx.interpretation),
      aboveFoldArchetypeId: archetype.id,
    };
  }
  return {
    ...base,
    heroExpression: base.heroExpression ?? heroExpressionFromDesignRegime(resolveFinalDesignRegime(base)),
    resolverConfidence: base.resolverConfidence ?? { level: "low", score: 0.35 },
  };
}
