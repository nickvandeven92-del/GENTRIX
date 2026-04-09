import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

/** Drie niveaus voor above-fold-resolver (afgeleid; geen aparte interpretatiebron). */
export type ScoreLevel = "low" | "medium" | "high";

export type UserIntentSiteCategory =
  | "commerce"
  | "service_business"
  | "content_publisher"
  | "portfolio"
  | "saas_tool"
  | "other";

/** Samenvattende visuele modus voor above-fold-keuze. */
export type UserIntentVisualMode =
  | "corporate_trust"
  | "brand_campaign"
  | "creative_portfolio"
  | "editorial_clean"
  | "retail_promo"
  | "minimal_product"
  | "experimental_brand";

export type AboveFoldPriority =
  | "hero_product_focus"
  | "brand_statement"
  | "trust_first"
  | "editorial_entry"
  | "balanced";

/**
 * Pure view op {@link PromptInterpretation} + {@link HeuristicSignalProfile}.
 * Geen concurrerende waarheid — alleen deterministische projectie.
 */
export type UserIntentProfile = {
  confidence: number;
  mediaDominance: ScoreLevel;
  commerceWeight: ScoreLevel;
  trustWeight: ScoreLevel;
  editorialSignal: ScoreLevel;
  visualAggression: ScoreLevel;
  experimentationSignal: ScoreLevel;
  temporalSignal: ScoreLevel;
  contentVolume: ScoreLevel;
  siteCategory: UserIntentSiteCategory;
  visualMode: UserIntentVisualMode;
  aboveFoldPriority: AboveFoldPriority;
};

export type VisualDesignRegimeMode =
  | "retail_dynamic"
  | "conversion_sharp"
  | "corporate_trust"
  | "editorial_clean"
  | "creative_portfolio"
  | "brand_campaign"
  | "calm_premium"
  | "luxury_brand"
  | "minimal_modern";

export type VisualUrgencyStyle = "none" | "subtle" | "visible" | "aggressive";

export type VisualMotionStyle = "static" | "subtle_motion" | "dynamic" | "high_energy";

/**
 * Visueel/commercieel regime (niet te verwarren met `DesignRegime` = hero_split / hero_integrated op {@link SiteIntent}).
 */
export type VisualDesignRegime = {
  mode: VisualDesignRegimeMode;
  urgencyStyle: VisualUrgencyStyle;
  motionStyle: VisualMotionStyle;
};

function maxTone(profile: HeuristicSignalProfile): keyof HeuristicSignalProfile["visualToneScores"] {
  const s = profile.visualToneScores;
  let best: keyof typeof s = "minimal";
  let v = -1;
  for (const k of Object.keys(s) as (keyof typeof s)[]) {
    if (s[k] > v) {
      v = s[k];
      best = k;
    }
  }
  return best;
}

function isScoreHigh(n: number, threshold: number): boolean {
  return n >= threshold;
}

/**
 * Bouwt {@link UserIntentProfile} uitsluitend uit gemergde interpretatie + heuristic profile.
 */
export function buildUserIntentProfileFromInterpretation(
  i: PromptInterpretation,
  profile: HeuristicSignalProfile,
): UserIntentProfile {
  const boldE = profile.visualEnergyScores.bold;
  const calmE = profile.visualEnergyScores.calm;
  const dominantTone = maxTone(profile);

  let mediaDominance: ScoreLevel = "low";
  if (i.visualEnergy === "bold" || isScoreHigh(boldE, 14) || (i.visualRestraint === "low" && i.uniquenessNeed === "high")) {
    mediaDominance = "high";
  } else if (i.visualEnergy === "balanced" || boldE > calmE || i.visualTone === "playful" || dominantTone === "editorial") {
    mediaDominance = "medium";
  }

  let commerceWeight: ScoreLevel = "low";
  if (i.businessModel === "product" && i.primaryGoal === "sales") {
    commerceWeight = "high";
  } else if (i.primaryGoal === "sales" || i.businessModel === "product" || i.businessModel === "hybrid") {
    commerceWeight = "medium";
  }

  let trustWeight: ScoreLevel = i.trustNeed;
  if (i.proofNeed === "high" && trustWeight !== "high") {
    trustWeight = trustWeight === "low" ? "medium" : "high";
  }
  if (isScoreHigh(profile.trustRaw, 20) && trustWeight !== "high") {
    trustWeight = "medium";
  }

  let editorialSignal: ScoreLevel = "low";
  if (i.businessModel === "content" || i.visualTone === "editorial") {
    editorialSignal = "high";
  } else if (i.scanBehavior === "exploratory" || i.contentDepth === "rich" || dominantTone === "editorial") {
    editorialSignal = "medium";
  }

  let visualAggression: ScoreLevel = "low";
  if (i.ctaUrgency === "high" || i.visualEnergy === "bold") {
    visualAggression = "high";
  } else if (i.ctaUrgency === "medium" || i.emotionalTone === "bold") {
    visualAggression = "medium";
  }

  const experimentationSignal: ScoreLevel = i.uniquenessNeed;
  const temporalSignal: ScoreLevel = i.ctaUrgency;

  let contentVolume: ScoreLevel = "medium";
  if (i.contentDepth === "rich" || i.scanBehavior === "exploratory") contentVolume = "high";
  else if (i.contentDepth === "lean") contentVolume = "low";

  let siteCategory: UserIntentSiteCategory = "other";
  if (i.businessModel === "portfolio") siteCategory = "portfolio";
  else if (i.businessModel === "content") siteCategory = "content_publisher";
  else if (i.businessModel === "service") siteCategory = "service_business";
  else if (i.businessModel === "product" && i.primaryGoal === "signup") siteCategory = "saas_tool";
  else if (i.businessModel === "product" && i.primaryGoal === "sales") siteCategory = "commerce";
  else if (i.businessModel === "product" || i.businessModel === "hybrid") siteCategory = "commerce";

  let visualMode: UserIntentVisualMode = "retail_promo";
  if (i.visualTone === "corporate" && trustWeight === "high") {
    visualMode = "corporate_trust";
  } else if (i.primaryGoal === "branding" && (i.visualEnergy === "bold" || mediaDominance === "high")) {
    visualMode = "brand_campaign";
  } else if (i.uniquenessNeed === "high" && i.visualEnergy === "bold") {
    visualMode = "experimental_brand";
  } else if (i.businessModel === "portfolio" || i.uniquenessNeed === "high") {
    visualMode = "creative_portfolio";
  } else if (editorialSignal === "high" || i.visualTone === "editorial") {
    visualMode = "editorial_clean";
  } else if (commerceWeight === "high" && (i.ctaUrgency === "high" || visualAggression === "high")) {
    visualMode = "retail_promo";
  } else if (i.visualTone === "minimal" && i.visualRestraint === "high") {
    visualMode = "minimal_product";
  } else if (commerceWeight === "high") {
    visualMode = "retail_promo";
  } else {
    visualMode = "corporate_trust";
  }

  let aboveFoldPriority: AboveFoldPriority = "balanced";
  if (i.primaryGoal === "sales" && i.businessModel === "product") aboveFoldPriority = "hero_product_focus";
  else if (i.primaryGoal === "branding" && i.businessModel === "content") aboveFoldPriority = "editorial_entry";
  else if (i.primaryGoal === "branding") aboveFoldPriority = "brand_statement";
  else if (i.primaryGoal === "lead_generation" && i.businessModel === "service") aboveFoldPriority = "trust_first";
  else if (i.businessModel === "content") aboveFoldPriority = "editorial_entry";

  return {
    confidence: i.confidence,
    mediaDominance,
    commerceWeight,
    trustWeight,
    editorialSignal,
    visualAggression,
    experimentationSignal,
    temporalSignal,
    contentVolume,
    siteCategory,
    visualMode,
    aboveFoldPriority,
  };
}

/**
 * Afgeleid visueel regime; optioneel {@link SiteIntent} voor experience-model-hints (geen tweede interpretatie).
 */
export function buildVisualDesignRegimeFromInterpretation(
  i: PromptInterpretation,
  profile: HeuristicSignalProfile,
  siteIntent?: SiteIntent,
): VisualDesignRegime {
  let urgencyStyle: VisualUrgencyStyle = "visible";
  if (i.ctaUrgency === "low") urgencyStyle = "none";
  else if (i.ctaUrgency === "medium") urgencyStyle = "visible";
  else urgencyStyle = "aggressive";

  let motionStyle: VisualMotionStyle = "subtle_motion";
  if (i.visualEnergy === "calm") motionStyle = "static";
  else if (i.visualEnergy === "bold") motionStyle = "high_energy";
  else if (i.scanBehavior === "fast") motionStyle = "dynamic";

  const model = siteIntent?.experienceModel;
  let mode: VisualDesignRegimeMode = "conversion_sharp";

  if (model === "ecommerce_home" || model === "search_first_catalog") {
    mode = "retail_dynamic";
  } else if (model === "editorial_content_hub" || model === "health_authority_content") {
    mode = "editorial_clean";
  } else if (model === "brand_storytelling" || model === "community_media") {
    mode = "creative_portfolio";
  } else if (model === "premium_product") {
    mode = "luxury_brand";
  } else if (model === "service_leadgen") {
    mode = "corporate_trust";
  } else if (i.visualTone === "luxury") {
    mode = "luxury_brand";
  } else if (i.visualTone === "minimal" && i.visualRestraint === "high") {
    mode = "minimal_modern";
  } else if (i.primaryGoal === "branding" && i.visualEnergy === "bold") {
    mode = "brand_campaign";
  } else if (i.businessModel === "portfolio" || profile.businessModelScores.portfolio >= 8) {
    mode = "creative_portfolio";
  } else if (i.primaryGoal === "sales") {
    mode = "retail_dynamic";
  } else if (i.trustNeed === "high" && i.visualTone === "corporate") {
    mode = "corporate_trust";
  } else {
    mode = "calm_premium";
  }

  return { mode, urgencyStyle, motionStyle };
}
