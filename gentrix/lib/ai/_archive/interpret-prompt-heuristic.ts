import type {
  BusinessModelInterpreted,
  PrimaryGoalInterpreted,
  PromptInterpretation,
  VisualEnergy,
  VisualTone,
} from "@/lib/ai/prompt-interpretation-types";
import { scorePromptSignals, type HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";

function pickMaxKey<K extends string>(scores: Record<K, number>, fallback: K): K {
  const keys = Object.keys(scores) as K[];
  let best: K = fallback;
  let max = -Infinity;
  for (const k of keys) {
    const v = scores[k] ?? 0;
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}

function deriveContentDepthHeuristic(
  businessModel: BusinessModelInterpreted,
  scanBehavior: PromptInterpretation["scanBehavior"],
  primaryGoal: PrimaryGoalInterpreted,
): PromptInterpretation["contentDepth"] {
  if (businessModel === "content") return "rich";
  if (scanBehavior === "fast" && primaryGoal !== "branding") return "lean";
  return "medium";
}

function deriveEmotionalToneHeuristic(
  visualTone: VisualTone,
  visualEnergy: VisualEnergy,
): PromptInterpretation["emotionalTone"] {
  if (visualTone === "corporate" || visualTone === "tech") return "authoritative";
  if (visualTone === "playful") return "friendly";
  if (visualTone === "luxury" || visualTone === "editorial") return "aspirational";
  if (visualTone === "industrial" || visualEnergy === "bold") return "bold";
  return "practical";
}

function deriveCtaUrgencyHeuristic(
  primaryGoal: PrimaryGoalInterpreted,
  scanBehavior: PromptInterpretation["scanBehavior"],
): PromptInterpretation["ctaUrgency"] {
  if (primaryGoal === "lead_generation" || primaryGoal === "sales") return "high";
  if (primaryGoal === "branding" && scanBehavior === "exploratory") return "low";
  return "medium";
}

function deriveAudienceTypeHeuristic(
  businessModel: BusinessModelInterpreted,
  primaryGoal: PrimaryGoalInterpreted,
  b2bBoost: number,
  serviceScore: number,
): PromptInterpretation["audienceType"] {
  if (b2bBoost > serviceScore) return "business";
  if (businessModel === "content" && primaryGoal === "branding") return "consumer";
  return "mixed";
}

function rawToLowMedHigh(raw: number): "low" | "medium" | "high" {
  if (raw >= 4) return "high";
  if (raw >= 1.5) return "medium";
  return "low";
}

function heuristicConfidence(profile: HeuristicSignalProfile): number {
  const richness =
    profile.tokenHitsApprox +
    profile.phraseHits.length * 2 +
    profile.contrastEffects.length * 0.75 +
    (profile.industryHint ? 2 : 0);
  if (richness < 2) return 0.25;
  if (richness < 6) return 0.45;
  if (richness < 14) return 0.6;
  return 0.72;
}

/**
 * Zet scoreprofiel om naar PromptInterpretation (fallback-laag).
 */
export function interpretationFromHeuristicProfile(
  profile: HeuristicSignalProfile,
): PromptInterpretation {
  const visualTone: VisualTone = pickMaxKey(profile.visualToneScores, "minimal");
  const visualEnergy: VisualEnergy = pickMaxKey(profile.visualEnergyScores, "balanced");
  const primaryGoal: PrimaryGoalInterpreted = pickMaxKey(profile.primaryGoalScores, "lead_generation");
  const businessModel: BusinessModelInterpreted = pickMaxKey(profile.businessModelScores, "service");

  const trustNeed = rawToLowMedHigh(profile.trustRaw);
  const proofNeed = rawToLowMedHigh(profile.proofRaw + profile.trustRaw * 0.3);
  const visualRestraint = rawToLowMedHigh(profile.restraintRaw);
  const uniquenessNeed = rawToLowMedHigh(profile.uniquenessRaw);

  let scanBehavior: PromptInterpretation["scanBehavior"] = "balanced";
  if (profile.scanFastRaw > profile.scanExploratoryRaw + 1.5) scanBehavior = "fast";
  else if (profile.scanExploratoryRaw > profile.scanFastRaw + 1.5) scanBehavior = "exploratory";

  const contentDepth = deriveContentDepthHeuristic(businessModel, scanBehavior, primaryGoal);
  const emotionalTone = deriveEmotionalToneHeuristic(visualTone, visualEnergy);
  const ctaUrgency = deriveCtaUrgencyHeuristic(primaryGoal, scanBehavior);
  const audienceType = deriveAudienceTypeHeuristic(
    businessModel,
    primaryGoal,
    profile.businessModelScores.product + profile.visualToneScores.tech,
    profile.businessModelScores.service,
  );

  return {
    confidence: heuristicConfidence(profile),
    businessModel,
    primaryGoal,
    audienceType,
    trustNeed,
    proofNeed,
    visualTone,
    visualEnergy,
    visualRestraint,
    contentDepth,
    scanBehavior,
    emotionalTone,
    ctaUrgency,
    uniquenessNeed,
    industryHint: profile.industryHint,
  };
}

export function interpretPromptHeuristicOnly(normalizedText: string): {
  interpretation: PromptInterpretation;
  profile: HeuristicSignalProfile;
} {
  const profile = scorePromptSignals(normalizedText);
  return {
    interpretation: interpretationFromHeuristicProfile(profile),
    profile,
  };
}
