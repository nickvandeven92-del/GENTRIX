import type { InterpretationSource, PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";

function pickStrongerVisualTone(
  ai: PromptInterpretation["visualTone"],
  h: PromptInterpretation["visualTone"],
  profile: HeuristicSignalProfile,
): PromptInterpretation["visualTone"] {
  const sa = profile.visualToneScores[ai] ?? 0;
  const sh = profile.visualToneScores[h] ?? 0;
  if (sh > sa + 1.5) return h;
  if (sa > sh + 1.5) return ai;
  return sa >= sh ? ai : h;
}

/**
 * AI-interpretatie + heuristisch profiel: reparatie bij harde conflicten, daarna confidence-gewogen samenvoeging.
 */
export function mergePromptInterpretations(
  ai: PromptInterpretation | null,
  heuristic: PromptInterpretation,
  profile: HeuristicSignalProfile,
): { merged: PromptInterpretation; source: InterpretationSource } {
  if (!ai) {
    return { merged: heuristic, source: "heuristic" };
  }

  let merged: PromptInterpretation = { ...ai };
  const gs = profile.primaryGoalScores;

  if (gs.sales >= 4 && gs.branding < 2.5 && merged.primaryGoal === "branding") {
    merged.primaryGoal = "sales";
  }
  if (gs.lead_generation >= 4 && merged.primaryGoal === "branding" && gs.sales < 3) {
    merged.primaryGoal = "lead_generation";
  }
  if (gs.signup >= 3 && merged.primaryGoal === "branding" && gs.sales < 2) {
    merged.primaryGoal = "signup";
  }

  const c = ai.confidence;
  if (c < 0.48) {
    merged = {
      ...heuristic,
      industryHint: ai.industryHint ?? heuristic.industryHint,
      confidence: Math.min(0.55, Math.max(heuristic.confidence, c * 0.9)),
    };
    return { merged, source: "blended" };
  }

  if (c < 0.72) {
    merged.visualTone = pickStrongerVisualTone(ai.visualTone, heuristic.visualTone, profile);
    merged.visualEnergy =
      profile.visualEnergyScores[heuristic.visualEnergy] > profile.visualEnergyScores[ai.visualEnergy] + 1
        ? heuristic.visualEnergy
        : ai.visualEnergy;
    merged.primaryGoal =
      gs[heuristic.primaryGoal] > gs[ai.primaryGoal] + 2 ? heuristic.primaryGoal : merged.primaryGoal;
    merged.businessModel =
      profile.businessModelScores[heuristic.businessModel] >
      profile.businessModelScores[ai.businessModel] + 2.5
        ? heuristic.businessModel
        : merged.businessModel;
    merged.trustNeed =
      heuristic.trustNeed === "high" || profile.trustRaw >= 4 ? heuristic.trustNeed : merged.trustNeed;
    merged.proofNeed = heuristic.proofNeed === "high" ? "high" : merged.proofNeed;
    merged.uniquenessNeed =
      profile.uniquenessRaw >= 3 ? heuristic.uniquenessNeed : merged.uniquenessNeed;
    merged.confidence = (c + heuristic.confidence) / 2;
    return { merged, source: "blended" };
  }

  /** Zelfs bij “hoge” AI-confidence: als heuristiek veel sterker een andere visualTone ondersteunt, corrigeren (o.a. vintage/editorial). */
  const toneAi = merged.visualTone;
  const toneHeur = heuristic.visualTone;
  if (toneAi !== toneHeur) {
    const sa = profile.visualToneScores[toneAi] ?? 0;
    const sh = profile.visualToneScores[toneHeur] ?? 0;
    if (sh > sa + 5) {
      merged.visualTone = pickStrongerVisualTone(toneAi, toneHeur, profile);
      return { merged, source: "blended" };
    }
  }

  return { merged, source: "claude" };
}
