import { z } from "zod";

export const SITE_EXPERIENCE_MODEL_VALUES = [
  "saas_landing",
  "service_leadgen",
  "premium_product",
  "ecommerce_home",
  "search_first_catalog",
  "editorial_content_hub",
  "health_authority_content",
  "hybrid_content_commerce",
  "brand_storytelling",
  "community_media",
] as const;

export type SiteExperienceModel = (typeof SITE_EXPERIENCE_MODEL_VALUES)[number];

export const siteExperienceModelSchema = z.enum(SITE_EXPERIENCE_MODEL_VALUES);

/** Above-fold strategie voor hero-layout (`buildStudioPromptLayoutMaps` + prompt). */
export const DESIGN_REGIME_VALUES = ["hero_split", "hero_integrated", "hero_mixed"] as const;
export type DesignRegime = (typeof DESIGN_REGIME_VALUES)[number];
export const designRegimeSchema = z.enum(DESIGN_REGIME_VALUES);

/** Above-fold archetype-id (resolver); zelfde waarden als `above-fold-plan`. */
export const ABOVE_FOLD_ARCHETYPE_IDS = [
  "integrated_campaign_media",
  "editorial_full_bleed",
  "product_split_conversion",
  "trust_split_clarity",
  "immersive_overlay_statement",
  "minimal_statement",
  "showcase_media_wall",
  "dense_commerce_stage",
  "service_conversational",
] as const;
export type AboveFoldArchetypeId = (typeof ABOVE_FOLD_ARCHETYPE_IDS)[number];
export const aboveFoldArchetypeIdSchema = z.enum(ABOVE_FOLD_ARCHETYPE_IDS);

/**
 * Grovere hero-stuurlaag voor layout-maps + prompts (`getEffectiveHeroExpression`).
 * Afgeleid uit resolver of uit `DesignRegime` als fallback.
 */
export const HERO_EXPRESSION_VALUES = [
  "split_clear",
  "integrated_hero",
  "integrated_campaign",
  "editorial_calm",
  "immersive_overlay",
  "showcase_visual",
  "commerce_dense",
  "service_trust",
  "minimal_typographic",
  "balanced_mixed",
] as const;
export type HeroExpression = (typeof HERO_EXPRESSION_VALUES)[number];
export const heroExpressionSchema = z.enum(HERO_EXPRESSION_VALUES);

export const RESOLVER_CONFIDENCE_LEVEL_VALUES = ["low", "medium", "high"] as const;
export type ResolverConfidenceLevel = (typeof RESOLVER_CONFIDENCE_LEVEL_VALUES)[number];
export const resolverConfidenceLevelSchema = z.enum(RESOLVER_CONFIDENCE_LEVEL_VALUES);

/** Betrouwbaarheid van de above-fold-/intent-resolver (0–1 + bucket). */
export type ResolverConfidence = {
  level: ResolverConfidenceLevel;
  score: number;
};

export const resolverConfidenceSchema = z.object({
  level: resolverConfidenceLevelSchema,
  score: z.number().min(0).max(1),
});

export type NavigationDepth = "minimal" | "standard" | "category_rich" | "portal";
export type DensityProfile = "airy" | "balanced" | "dense_commerce";
export type ConversionModel =
  | "lead_capture"
  | "direct_purchase"
  | "content_discovery"
  | "search_discovery"
  | "membership_signup"
  | "hybrid";

export type SiteIntent = {
  experienceModel: SiteExperienceModel;
  /** Above-fold regime; optioneel (oude data). Layout/prompt: `resolveFinalDesignRegime` vouwt `hero_mixed` uit naar split/integrated. */
  designRegime?: DesignRegime;
  /** Hero-compositie-intent; gezet door `ensureSiteIntentAboveFoldFields` of fallback via design regime. */
  heroExpression?: HeroExpression;
  /** Hoe zeker de pipeline is over above-fold-keuze (interpretatie.confidence-gedreven). */
  resolverConfidence?: ResolverConfidence;
  /** Laatste resolved archetype wanneer interpretatiecontext beschikbaar was. */
  aboveFoldArchetypeId?: AboveFoldArchetypeId;
  navigationDepth: NavigationDepth;
  densityProfile: DensityProfile;
  conversionModel: ConversionModel;
  searchImportance: "none" | "supporting" | "primary";
  trustStyle: "subtle" | "retail" | "authority" | "social_proof_heavy";
  contentStrategy: "low" | "medium" | "high";
  businessModel: string;
  recommendedHomepagePattern: string[];
};

export const siteIntentSchema = z.object({
  experienceModel: siteExperienceModelSchema,
  designRegime: designRegimeSchema.optional(),
  heroExpression: heroExpressionSchema.optional(),
  resolverConfidence: resolverConfidenceSchema.optional(),
  aboveFoldArchetypeId: aboveFoldArchetypeIdSchema.optional(),
  navigationDepth: z.enum(["minimal", "standard", "category_rich", "portal"]),
  densityProfile: z.enum(["airy", "balanced", "dense_commerce"]),
  conversionModel: z.enum([
    "lead_capture",
    "direct_purchase",
    "content_discovery",
    "search_discovery",
    "membership_signup",
    "hybrid",
  ]),
  searchImportance: z.enum(["none", "supporting", "primary"]),
  trustStyle: z.enum(["subtle", "retail", "authority", "social_proof_heavy"]),
  contentStrategy: z.enum(["low", "medium", "high"]),
  businessModel: z.string().min(3).max(200),
  recommendedHomepagePattern: z.array(z.string()).min(1).max(24),
});

/** Default bij ontbrekende of oude opgeslagen config. */
export function defaultSiteIntent(): SiteIntent {
  return {
    experienceModel: "saas_landing",
    designRegime: "hero_mixed",
    navigationDepth: "standard",
    densityProfile: "balanced",
    conversionModel: "lead_capture",
    searchImportance: "none",
    trustStyle: "subtle",
    contentStrategy: "low",
    businessModel: "Algemene zakelijke dienstverlening",
    recommendedHomepagePattern: [
      "hero met kernboodschap",
      "voordelen of aanbod",
      "referenties of quotes",
      "prijzen of pakketten (indien passend)",
      "veelgestelde vragen",
      "paginavoet",
    ],
  };
}
