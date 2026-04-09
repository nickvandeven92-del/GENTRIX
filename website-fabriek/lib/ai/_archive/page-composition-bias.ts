import type { AboveFoldArchetypeId, HeroExpression } from "@/lib/ai/site-experience-model";

export type PageCompositionRhythmMode =
  | "tight_conversion"
  | "balanced_progression"
  | "editorial_breathing"
  | "immersive_showcase";

export type PageCompositionDensity = "minimal" | "curated" | "standard" | "dense";

export type PageCompositionProofStyle =
  | "minimal_trust"
  | "embedded_social_proof"
  | "stacked_authority"
  | "results_driven";

export type PageCompositionCtaIntensity = "soft" | "moderate" | "assertive" | "high";

export type PageCompositionBias = {
  featuresBias: {
    density: PageCompositionDensity;
    preferredTags: string[];
    discouragedTags: string[];
  };
  proofBias: {
    style: PageCompositionProofStyle;
    preferredTags: string[];
    discouragedTags: string[];
  };
  ctaBias: {
    intensity: PageCompositionCtaIntensity;
    preferredTags: string[];
    discouragedTags: string[];
  };
  rhythmBias: {
    mode: PageCompositionRhythmMode;
    discourageRepeatingCards: boolean;
    discourageEarlyPricing: boolean;
    preferVisualContinuation: boolean;
  };
  antiPatterns: string[];
};

const CINEMATIC_IMMERSIVE: PageCompositionBias = {
  featuresBias: {
    density: "minimal",
    preferredTags: [
      "editorial",
      "luxury_minimal",
      "immersive_media",
      "visual",
      "curated",
      "immersive",
    ],
    discouragedTags: ["dense_grid", "catalog_dense", "conversion_push", "small_cards", "bullet_heavy"],
  },
  proofBias: {
    style: "embedded_social_proof",
    preferredTags: ["embedded", "subtle", "brand_proof"],
    discouragedTags: ["proof_heavy", "hard_numbers", "dense_testimonial_grid"],
  },
  ctaBias: {
    intensity: "soft",
    preferredTags: ["editorial_cta", "minimal_cta"],
    discouragedTags: ["aggressive_cta", "conversion_push", "stacked_cta"],
  },
  rhythmBias: {
    mode: "immersive_showcase",
    discourageRepeatingCards: true,
    discourageEarlyPricing: true,
    preferVisualContinuation: true,
  },
  antiPatterns: [
    "do_not_drop_into_generic_saas_cards_after_hero",
    "avoid_overexplaining_with_long_marketing_copy",
  ],
};

const PRODUCT_SHOWCASE: PageCompositionBias = {
  featuresBias: {
    density: "curated",
    preferredTags: [
      "product",
      "conversion_push",
      "catalog_dense",
      "comparison",
      "benefits",
      "visual_specs",
    ],
    discouragedTags: ["abstract_editorial", "luxury_minimal", "service_filler"],
  },
  proofBias: {
    style: "results_driven",
    preferredTags: ["results", "outcomes", "comparison_proof", "proof_heavy"],
    discouragedTags: ["soft_quote_only"],
  },
  ctaBias: {
    intensity: "assertive",
    preferredTags: ["product_cta", "offer_cta", "comparison_cta"],
    discouragedTags: ["soft_story_cta"],
  },
  rhythmBias: {
    mode: "balanced_progression",
    discourageRepeatingCards: true,
    discourageEarlyPricing: false,
    preferVisualContinuation: true,
  },
  antiPatterns: ["avoid_feature_grid_without_product_anchor"],
};

const TRUST_GROUNDED: PageCompositionBias = {
  featuresBias: {
    density: "standard",
    preferredTags: ["trust_human", "clarity", "service", "benefits", "trust", "editorial"],
    discouragedTags: ["hype", "conversion_push", "visual_noise"],
  },
  proofBias: {
    style: "stacked_authority",
    preferredTags: ["proof_heavy", "logos", "credentials", "authority", "testimonials"],
    discouragedTags: ["flashy_proof"],
  },
  ctaBias: {
    intensity: "moderate",
    preferredTags: ["consultation_cta", "contact_cta"],
    discouragedTags: ["pushy_offer_cta"],
  },
  rhythmBias: {
    mode: "balanced_progression",
    discourageRepeatingCards: false,
    discourageEarlyPricing: true,
    preferVisualContinuation: false,
  },
  antiPatterns: ["do_not_framing_services_as_anonymous_ecommerce"],
};

const CAMPAIGN_CONVERSION: PageCompositionBias = {
  featuresBias: {
    density: "curated",
    preferredTags: [
      "conversion_push",
      "catalog_dense",
      "benefits",
      "results",
      "conversion",
      "offer",
    ],
    discouragedTags: ["editorial_detour", "luxury_minimal", "brand_filler"],
  },
  proofBias: {
    style: "results_driven",
    preferredTags: ["proof_heavy", "numbers", "wins", "proof", "outcomes"],
    discouragedTags: ["soft_subtle_proof"],
  },
  ctaBias: {
    intensity: "high",
    preferredTags: ["primary_cta", "offer_cta", "conversion_cta"],
    discouragedTags: ["passive_cta"],
  },
  rhythmBias: {
    mode: "tight_conversion",
    discourageRepeatingCards: true,
    discourageEarlyPricing: false,
    preferVisualContinuation: false,
  },
  antiPatterns: [
    "avoid_slow_storytelling_before_value_is_clear",
    "do_not_bury_primary_cta",
  ],
};

const BALANCED_DEFAULT: PageCompositionBias = {
  featuresBias: {
    density: "standard",
    preferredTags: ["clarity", "benefits", "curated", "editorial", "trust_human"],
    discouragedTags: ["dense_grid", "abstract_editorial"],
  },
  proofBias: {
    style: "embedded_social_proof",
    preferredTags: ["proof", "trust"],
    discouragedTags: ["flashy_proof"],
  },
  ctaBias: {
    intensity: "moderate",
    preferredTags: ["primary_cta"],
    discouragedTags: ["stacked_cta"],
  },
  rhythmBias: {
    mode: "balanced_progression",
    discourageRepeatingCards: true,
    discourageEarlyPricing: false,
    preferVisualContinuation: false,
  },
  antiPatterns: ["avoid_three_identical_card_rows_in_a_row"],
};

function cloneBias(b: PageCompositionBias): PageCompositionBias {
  return {
    featuresBias: {
      ...b.featuresBias,
      preferredTags: [...b.featuresBias.preferredTags],
      discouragedTags: [...b.featuresBias.discouragedTags],
    },
    proofBias: {
      ...b.proofBias,
      preferredTags: [...b.proofBias.preferredTags],
      discouragedTags: [...b.proofBias.discouragedTags],
    },
    ctaBias: {
      ...b.ctaBias,
      preferredTags: [...b.ctaBias.preferredTags],
      discouragedTags: [...b.ctaBias.discouragedTags],
    },
    rhythmBias: { ...b.rhythmBias },
    antiPatterns: [...b.antiPatterns],
  };
}

/** Basis per `HeroExpression` (canonical in codebase). */
function baseBiasForHeroExpression(expr: HeroExpression): PageCompositionBias {
  switch (expr) {
    case "editorial_calm":
    case "immersive_overlay":
    case "minimal_typographic":
      return cloneBias(CINEMATIC_IMMERSIVE);
    case "showcase_visual":
    case "split_clear":
      return cloneBias(PRODUCT_SHOWCASE);
    case "service_trust":
      return cloneBias(TRUST_GROUNDED);
    case "integrated_campaign":
    case "commerce_dense":
      return cloneBias(CAMPAIGN_CONVERSION);
    case "integrated_hero":
    case "balanced_mixed":
    default:
      return cloneBias(BALANCED_DEFAULT);
  }
}

/** Lichte archetype-verfijning — overschrijft de basis niet volledig. */
function refineBiasWithArchetype(
  bias: PageCompositionBias,
  archetypeId: AboveFoldArchetypeId | null | undefined,
): PageCompositionBias {
  if (!archetypeId) return bias;
  const b = cloneBias(bias);

  const conversionHeavy: AboveFoldArchetypeId[] = [
    "dense_commerce_stage",
    "integrated_campaign_media",
    "product_split_conversion",
  ];
  const editorialImmersive: AboveFoldArchetypeId[] = [
    "editorial_full_bleed",
    "immersive_overlay_statement",
    "showcase_media_wall",
    "minimal_statement",
  ];
  const trustService: AboveFoldArchetypeId[] = ["trust_split_clarity", "service_conversational"];

  if (conversionHeavy.includes(archetypeId)) {
    b.ctaBias.intensity =
      b.ctaBias.intensity === "soft" ? "moderate" : b.ctaBias.intensity === "moderate" ? "assertive" : "high";
    b.proofBias.preferredTags.push("numbers", "wins");
    b.proofBias.discouragedTags = [...new Set([...b.proofBias.discouragedTags, "soft_quote_only"])];
  }

  if (editorialImmersive.includes(archetypeId)) {
    b.featuresBias.density = b.featuresBias.density === "dense" ? "curated" : "minimal";
    b.featuresBias.preferredTags.push("visual", "editorial");
    b.rhythmBias.preferVisualContinuation = true;
  }

  if (trustService.includes(archetypeId)) {
    b.proofBias.style = "stacked_authority";
    b.proofBias.preferredTags.push("credentials", "authority");
    b.ctaBias.intensity = "moderate";
  }

  return b;
}

export function buildPageCompositionBiasFromHeroExpression(input: {
  heroExpression: HeroExpression;
  aboveFoldArchetypeId?: AboveFoldArchetypeId | null;
}): PageCompositionBias {
  const base = baseBiasForHeroExpression(input.heroExpression);
  return refineBiasWithArchetype(base, input.aboveFoldArchetypeId);
}
