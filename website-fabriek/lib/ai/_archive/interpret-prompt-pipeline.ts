import type { SiteConfig } from "@/lib/ai/build-site-config";
import type { DesignPersonality } from "@/lib/ai/design-personality";
import {
  extractSiteIntentWithClaude,
  isExtractSiteIntentWithClaudeEnabled,
} from "@/lib/ai/extract-site-intent-with-claude";
import { extractPromptInterpretationWithClaude, isExtractPromptInterpretationWithClaudeEnabled } from "@/lib/ai/extract-prompt-interpretation-with-claude";
import { interpretPromptHeuristicOnly } from "@/lib/ai/interpret-prompt-heuristic";
import { mergePromptInterpretations } from "@/lib/ai/merge-prompt-interpretation";
import { preparePromptForInterpretation } from "@/lib/ai/prompt-normalization";
import type { InterpretationSource, PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import { ensureSiteIntentDesignRegime } from "@/lib/ai/above-fold-archetypes";
import { ensureSiteIntentAboveFoldFields } from "@/lib/ai/ensure-site-intent-above-fold";
import { resolveSiteIntentFromInterpretation } from "@/lib/ai/resolve-site-intent-from-interpretation";
import {
  resolveBrandStyleFromInterpretation,
  resolvePersonalityFromInterpretation,
  resolvePrimaryGoalString,
  resolveTargetAudienceDescription,
} from "@/lib/ai/resolve-visual-from-interpretation";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

export type InterpretPromptPipelineResult = {
  interpretation: PromptInterpretation;
  source: InterpretationSource;
  profile: HeuristicSignalProfile;
  siteIntent: SiteIntent;
  personality: DesignPersonality;
  brandStyle: SiteConfig["brand_style"];
  primaryGoal: SiteConfig["primary_goal"];
  targetAudience: string;
};

/**
 * Centrale interpretatie: normalisatie → scoreprofiel → heuristiek → (optioneel) Claude → merge → site_intent + visuele resolutie.
 */
export async function runPromptInterpretationPipeline(userPrompt: string): Promise<InterpretPromptPipelineResult> {
  const { normalized } = preparePromptForInterpretation(userPrompt);
  const { interpretation: heuristicInterp, profile } = interpretPromptHeuristicOnly(normalized);

  let aiInterp: PromptInterpretation | null = null;
  if (isExtractPromptInterpretationWithClaudeEnabled()) {
    const r = await extractPromptInterpretationWithClaude(userPrompt);
    if (r.ok) {
      aiInterp = r.data;
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[interpretPrompt] Claude-interpretatie mislukt, heuristiek+merge:", r.error);
    }
  }

  const { merged, source } = mergePromptInterpretations(aiInterp, heuristicInterp, profile);

  let siteIntent: SiteIntent = ensureSiteIntentAboveFoldFields(
    ensureSiteIntentDesignRegime(resolveSiteIntentFromInterpretation(merged, normalized, profile)),
    { interpretation: merged, profile },
  );

  const fullInterpActive = isExtractPromptInterpretationWithClaudeEnabled();
  if (!fullInterpActive && isExtractSiteIntentWithClaudeEnabled()) {
    const claudeIntent = await extractSiteIntentWithClaude(userPrompt);
    if (claudeIntent.ok) {
      siteIntent = ensureSiteIntentAboveFoldFields(ensureSiteIntentDesignRegime(claudeIntent.data), {
        interpretation: merged,
        profile,
      });
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[interpretPrompt] Claude site-intent mislukt, interpretatie-gedreven intent:", claudeIntent.error);
    }
  }

  const personality = resolvePersonalityFromInterpretation(merged, profile);
  const brandStyle = resolveBrandStyleFromInterpretation(merged, profile, normalized);
  const primaryGoal = resolvePrimaryGoalString(merged);
  const targetAudience = resolveTargetAudienceDescription(merged, normalized);

  return {
    interpretation: merged,
    source,
    profile,
    siteIntent,
    personality,
    brandStyle,
    primaryGoal,
    targetAudience,
  };
}
