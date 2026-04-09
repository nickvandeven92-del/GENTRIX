import { describe, expect, it } from "vitest";
import { biasHeroPoolByAboveFoldArchetype, resolveAboveFoldArchetype } from "@/lib/ai/above-fold-plan";
import { buildUserIntentProfileFromInterpretation, buildVisualDesignRegimeFromInterpretation } from "@/lib/ai/derive-user-intent-profile";
import { defaultHeuristicInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

function minimalProfile(): HeuristicSignalProfile {
  return {
    visualToneScores: {
      minimal: 0,
      luxury: 0,
      tech: 0,
      industrial: 0,
      editorial: 0,
      playful: 0,
      corporate: 0,
    },
    visualEnergyScores: { calm: 0, balanced: 10, bold: 0 },
    primaryGoalScores: {
      lead_generation: 0,
      sales: 0,
      signup: 0,
      branding: 0,
    },
    businessModelScores: {
      service: 0,
      product: 0,
      hybrid: 0,
      content: 0,
      portfolio: 0,
    },
    trustRaw: 0,
    proofRaw: 0,
    restraintRaw: 0,
    uniquenessRaw: 0,
    scanFastRaw: 0,
    scanExploratoryRaw: 0,
    phraseHits: [],
    negationEffects: [],
    contrastEffects: [],
    industryHint: null,
    industryHintId: null,
    tokenHitsApprox: 0,
    locale: "nl",
  };
}

describe("above-fold-plan", () => {
  it("e-commerce intent → retail_dynamic + product-gerelateerd archetype", () => {
    const i = {
      ...defaultHeuristicInterpretation(),
      confidence: 0.75,
      businessModel: "product" as const,
      primaryGoal: "sales" as const,
      ctaUrgency: "high" as const,
      visualEnergy: "bold" as const,
    };
    const profile = minimalProfile();
    profile.primaryGoalScores.sales = 20;
    profile.businessModelScores.product = 20;
    profile.visualEnergyScores.bold = 18;

    const userP = buildUserIntentProfileFromInterpretation(i, profile);
    const regime = buildVisualDesignRegimeFromInterpretation(i, profile, {
      experienceModel: "ecommerce_home",
      navigationDepth: "category_rich",
      densityProfile: "dense_commerce",
      conversionModel: "direct_purchase",
      searchImportance: "supporting",
      trustStyle: "retail",
      contentStrategy: "medium",
      businessModel: "x",
      recommendedHomepagePattern: ["a"],
    });
    expect(regime.mode).toBe("retail_dynamic");

    const resolved = resolveAboveFoldArchetype(userP, regime);
    expect(
      ["integrated_campaign_media", "dense_commerce_stage", "product_split_conversion"] as const,
    ).toContain(resolved.archetype.id);
  });

  it("biasHeroPoolByAboveFoldArchetype: doorsnede met pool, nooit leeg als pool niet leeg was", () => {
    const pool: LayoutArchetype[] = [
      "hero_split_product",
      "hero_centered_editorial",
      "hero_nav_split_product",
    ];
    const narrowed = biasHeroPoolByAboveFoldArchetype(pool, "product_split_conversion");
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((a) => pool.includes(a))).toBe(true);
  });
});
