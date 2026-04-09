import { z } from "zod";

/** Abstracte businessvorm — downstream: experience model, secties, conversie. */
export const BUSINESS_MODEL_INTERPRETED_VALUES = [
  "service",
  "product",
  "hybrid",
  "content",
  "portfolio",
] as const;
export type BusinessModelInterpreted = (typeof BUSINESS_MODEL_INTERPRETED_VALUES)[number];

export const PRIMARY_GOAL_INTERPRETED_VALUES = [
  "lead_generation",
  "sales",
  "signup",
  "branding",
] as const;
export type PrimaryGoalInterpreted = (typeof PRIMARY_GOAL_INTERPRETED_VALUES)[number];

export const TRUST_NEED_VALUES = ["low", "medium", "high"] as const;
export type TrustNeed = (typeof TRUST_NEED_VALUES)[number];

export const PROOF_NEED_VALUES = ["low", "medium", "high"] as const;
export type ProofNeed = (typeof PROOF_NEED_VALUES)[number];

export const VISUAL_TONE_VALUES = [
  "minimal",
  "luxury",
  "tech",
  "industrial",
  "editorial",
  "playful",
  "corporate",
] as const;
export type VisualTone = (typeof VISUAL_TONE_VALUES)[number];

export const VISUAL_ENERGY_VALUES = ["calm", "balanced", "bold"] as const;
export type VisualEnergy = (typeof VISUAL_ENERGY_VALUES)[number];

export const VISUAL_RESTRAINT_VALUES = ["low", "medium", "high"] as const;
export type VisualRestraint = (typeof VISUAL_RESTRAINT_VALUES)[number];

export const CONTENT_DEPTH_VALUES = ["lean", "medium", "rich"] as const;
export type ContentDepth = (typeof CONTENT_DEPTH_VALUES)[number];

export const SCAN_BEHAVIOR_VALUES = ["fast", "balanced", "exploratory"] as const;
export type ScanBehavior = (typeof SCAN_BEHAVIOR_VALUES)[number];

export const AUDIENCE_TYPE_VALUES = ["consumer", "business", "mixed"] as const;
export type AudienceType = (typeof AUDIENCE_TYPE_VALUES)[number];

export const EMOTIONAL_TONE_VALUES = [
  "practical",
  "authoritative",
  "friendly",
  "aspirational",
  "bold",
] as const;
export type EmotionalTone = (typeof EMOTIONAL_TONE_VALUES)[number];

export const CTA_URGENCY_VALUES = ["low", "medium", "high"] as const;
export type CtaUrgency = (typeof CTA_URGENCY_VALUES)[number];

export const UNIQUENESS_NEED_VALUES = ["low", "medium", "high"] as const;
export type UniquenessNeed = (typeof UNIQUENESS_NEED_VALUES)[number];

/**
 * Taal-onafhankelijke betekenislaag vóór brand_style / personality / site_intent.
 * Wordt primair door een model gevuld; heuristiek vult gaten en repareert conflicten.
 */
export type PromptInterpretation = {
  confidence: number;
  businessModel: BusinessModelInterpreted;
  primaryGoal: PrimaryGoalInterpreted;
  audienceType: AudienceType;
  trustNeed: TrustNeed;
  proofNeed: ProofNeed;
  visualTone: VisualTone;
  visualEnergy: VisualEnergy;
  visualRestraint: VisualRestraint;
  contentDepth: ContentDepth;
  scanBehavior: ScanBehavior;
  emotionalTone: EmotionalTone;
  ctaUrgency: CtaUrgency;
  uniquenessNeed: UniquenessNeed;
  /** Vrije korte branche/context; geen harde preset-koppeling. */
  industryHint: string | null;
};

export type InterpretationSource = "claude" | "heuristic" | "blended";

export type InterpretationPipelineResult = {
  interpretation: PromptInterpretation;
  source: InterpretationSource;
};

export const promptInterpretationSchema = z.object({
  confidence: z.number().min(0).max(1).default(0.5),
  businessModel: z.enum(BUSINESS_MODEL_INTERPRETED_VALUES),
  primaryGoal: z.enum(PRIMARY_GOAL_INTERPRETED_VALUES),
  audienceType: z.enum(AUDIENCE_TYPE_VALUES),
  trustNeed: z.enum(TRUST_NEED_VALUES),
  proofNeed: z.enum(PROOF_NEED_VALUES),
  visualTone: z.enum(VISUAL_TONE_VALUES),
  visualEnergy: z.enum(VISUAL_ENERGY_VALUES),
  visualRestraint: z.enum(VISUAL_RESTRAINT_VALUES),
  contentDepth: z.enum(CONTENT_DEPTH_VALUES),
  scanBehavior: z.enum(SCAN_BEHAVIOR_VALUES),
  emotionalTone: z.enum(EMOTIONAL_TONE_VALUES),
  ctaUrgency: z.enum(CTA_URGENCY_VALUES),
  uniquenessNeed: z.enum(UNIQUENESS_NEED_VALUES),
  industryHint: z.union([z.string().min(1).max(120), z.null()]).optional(),
});

export type RawPromptInterpretationJson = z.infer<typeof promptInterpretationSchema>;

export function normalizeInterpretationInput(
  raw: unknown,
): { ok: true; value: PromptInterpretation } | { ok: false; error: string } {
  const parsed = promptInterpretationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  const v = parsed.data;
  return {
    ok: true,
    value: {
      confidence: v.confidence,
      businessModel: v.businessModel,
      primaryGoal: v.primaryGoal,
      audienceType: v.audienceType,
      trustNeed: v.trustNeed,
      proofNeed: v.proofNeed,
      visualTone: v.visualTone,
      visualEnergy: v.visualEnergy,
      visualRestraint: v.visualRestraint,
      contentDepth: v.contentDepth,
      scanBehavior: v.scanBehavior,
      emotionalTone: v.emotionalTone,
      ctaUrgency: v.ctaUrgency,
      uniquenessNeed: v.uniquenessNeed,
      industryHint: v.industryHint ?? null,
    },
  };
}

export function defaultHeuristicInterpretation(): PromptInterpretation {
  return {
    confidence: 0.35,
    businessModel: "service",
    primaryGoal: "lead_generation",
    audienceType: "mixed",
    trustNeed: "medium",
    proofNeed: "medium",
    visualTone: "minimal",
    visualEnergy: "balanced",
    visualRestraint: "medium",
    contentDepth: "medium",
    scanBehavior: "balanced",
    emotionalTone: "practical",
    ctaUrgency: "medium",
    uniquenessNeed: "low",
    industryHint: null,
  };
}
