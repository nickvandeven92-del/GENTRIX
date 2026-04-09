import type { DesignPersonality } from "@/lib/ai/design-personality";
import type { VisualEnergy, VisualTone } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type { SiteExperienceModel } from "@/lib/ai/site-experience-model";

/** Weinig lexicon-treffers → branche mag iets bijsturen. */
const WEAK_TOKEN_THRESHOLD = 4;

/** Verschil #1 vs #2 personality-scores klein → tie-break. */
const CLOSE_CALL_GAP_PERSONALITY = 1.25;

/** Intent: duidelijke koppositie → geen branche-bias. */
const INTENT_CLEAR_LEADER_MIN = 6;
const INTENT_CLEAR_GAP = 2.5;

/** Intent: top twee dicht bij elkaar (zelfde schaal als modelscores). */
const CLOSE_CALL_GAP_INTENT = 1.25;

export function isWeakPromptSignals(profile: HeuristicSignalProfile): boolean {
  return profile.tokenHitsApprox < WEAK_TOKEN_THRESHOLD;
}

function sortedDesc(nums: number[]): number[] {
  return [...nums].sort((a, b) => b - a);
}

/** Top twee waarden liggen dicht bij elkaar (persoonlijkheidspool). */
export function isAmbiguousPersonalityRace(scores: Record<DesignPersonality, number>): boolean {
  const vals = sortedDesc(Object.values(scores));
  if (vals.length < 2) return true;
  return vals[0] - vals[1] < CLOSE_CALL_GAP_PERSONALITY;
}

export function shouldApplyIndustryVisualBias(
  profile: HeuristicSignalProfile | null | undefined,
  personalityScores: Record<DesignPersonality, number>,
): boolean {
  if (!profile?.industryHintId) return false;
  return isWeakPromptSignals(profile) || isAmbiguousPersonalityRace(personalityScores);
}

/**
 * Subtiele visuele zwaartekracht per branche (alleen als input zwak of ambigu is).
 * Waarden 0.3–0.8 op tone/energy; vertaald naar DesignPersonality-pool.
 */
export type IndustryVisualBiasLayer = {
  tone?: Partial<Record<VisualTone, number>>;
  energy?: Partial<Record<VisualEnergy, number>>;
};

export const INDUSTRY_VISUAL_BIAS: Record<string, IndustryVisualBiasLayer> = {
  construction_services: {
    tone: { industrial: 0.8, corporate: 0.2 },
    energy: { bold: 0.4 },
  },
  health_wellness: {
    tone: { minimal: 0.5, luxury: 0.2 },
    energy: { calm: 0.8 },
  },
  hospitality: {
    tone: { luxury: 0.5, editorial: 0.4 },
    energy: { balanced: 0.4 },
  },
  software: {
    tone: { tech: 0.8, minimal: 0.3, corporate: 0.2 },
  },
  creative: {
    tone: { editorial: 0.7, playful: 0.3, luxury: 0.2 },
  },
  real_estate: {
    tone: { editorial: 0.5, luxury: 0.35, minimal: 0.25 },
  },
  retail: {
    tone: { minimal: 0.35, corporate: 0.2 },
    energy: { balanced: 0.3 },
  },
  education: {
    tone: { editorial: 0.45, corporate: 0.25, minimal: 0.2 },
  },
};

const TONE_TO_PERSONALITIES: Record<VisualTone, DesignPersonality[]> = {
  minimal: ["minimal_tech"],
  luxury: ["elegant_luxury"],
  tech: ["minimal_tech"],
  industrial: ["bold_industrial"],
  editorial: ["editorial_art"],
  playful: ["playful_creative"],
  corporate: ["trust_conversion"],
};

const ENERGY_TO_PERSONALITIES: Record<VisualEnergy, DesignPersonality[]> = {
  calm: ["elegant_luxury", "minimal_tech"],
  bold: ["bold_industrial", "editorial_art"],
  balanced: ["minimal_tech", "editorial_art", "trust_conversion"],
};

function addDistributed(
  scores: Record<DesignPersonality, number>,
  personalities: DesignPersonality[],
  totalWeight: number,
): void {
  if (personalities.length === 0 || totalWeight === 0) return;
  const share = totalWeight / personalities.length;
  for (const p of personalities) {
    scores[p] = (scores[p] ?? 0) + share;
  }
}

/** Zet tone/energy-bias om naar personality-scores (mutatie). */
export function applyIndustryVisualBiasToPersonalityScores(
  scores: Record<DesignPersonality, number>,
  industryHintId: string,
): void {
  const layer = INDUSTRY_VISUAL_BIAS[industryHintId];
  if (!layer) return;

  if (layer.tone) {
    for (const [tone, w] of Object.entries(layer.tone) as [VisualTone, number][]) {
      if (w == null || w <= 0) continue;
      const personalities = TONE_TO_PERSONALITIES[tone];
      if (!personalities) continue;
      addDistributed(scores, personalities, w);
    }
  }
  if (layer.energy) {
    for (const [energy, w] of Object.entries(layer.energy) as [VisualEnergy, number][]) {
      if (w == null || w <= 0) continue;
      const personalities = ENERGY_TO_PERSONALITIES[energy];
      if (!personalities) continue;
      addDistributed(scores, personalities, w);
    }
  }
}

export function applyIndustryVisualBiasIfAmbiguous(
  scores: Record<DesignPersonality, number>,
  profile: HeuristicSignalProfile | null | undefined,
): void {
  if (!shouldApplyIndustryVisualBias(profile, scores) || !profile?.industryHintId) return;
  applyIndustryVisualBiasToPersonalityScores(scores, profile.industryHintId);
}

// --- Site intent: alleen tie-break / zwak signaal --------------------------------

/** Heel lichte duw richting experience-model (geen hoofdlogica). */
export const INDUSTRY_INTENT_BIAS: Record<string, Partial<Record<SiteExperienceModel, number>>> = {
  software: { saas_landing: 0.5 },
  retail: { ecommerce_home: 0.7 },
  creative: { brand_storytelling: 0.6, editorial_content_hub: 0.2 },
  education: { editorial_content_hub: 0.35, service_leadgen: 0.25 },
  health_wellness: { health_authority_content: 0.35 },
  hospitality: { premium_product: 0.55, brand_storytelling: 0.25, editorial_content_hub: 0.15 },
  construction_services: { service_leadgen: 0.3 },
  real_estate: { service_leadgen: 0.35, brand_storytelling: 0.2 },
};

function topTwoIntentScores(s: Record<SiteExperienceModel, number>): [number, number] {
  const vals = sortedDesc(Object.values(s));
  return [vals[0] ?? 0, vals[1] ?? 0];
}

/**
 * Branche mag intent alleen bijsturen als er geen duidelijke winnaar is uit hoofdsignalen
 * én (weinig tokens of dichte top-2).
 */
export function shouldApplyIndustryIntentBias(
  profile: HeuristicSignalProfile,
  modelScores: Record<SiteExperienceModel, number>,
): boolean {
  if (!profile.industryHintId) return false;
  const [best, second] = topTwoIntentScores(modelScores);
  const clearLeader = best >= INTENT_CLEAR_LEADER_MIN && best - second >= INTENT_CLEAR_GAP;
  if (clearLeader) return false;
  const close = best - second < CLOSE_CALL_GAP_INTENT;
  return isWeakPromptSignals(profile) || close;
}

export function applyIndustryIntentBiasIfAmbiguous(
  scores: Record<SiteExperienceModel, number>,
  profile: HeuristicSignalProfile,
): void {
  if (!shouldApplyIndustryIntentBias(profile, scores)) return;
  const delta = INDUSTRY_INTENT_BIAS[profile.industryHintId!];
  if (!delta) return;
  for (const k of Object.keys(delta) as SiteExperienceModel[]) {
    const v = delta[k];
    if (v != null) scores[k] = (scores[k] ?? 0) + v;
  }
}
