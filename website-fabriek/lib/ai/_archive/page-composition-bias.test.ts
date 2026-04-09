import { describe, expect, it } from "vitest";
import { buildPageCompositionBiasFromHeroExpression } from "@/lib/ai/page-composition-bias";

describe("buildPageCompositionBiasFromHeroExpression", () => {
  it("editorial_calm → immersive_showcase rhythm + antiPatterns", () => {
    const b = buildPageCompositionBiasFromHeroExpression({ heroExpression: "editorial_calm" });
    expect(b.rhythmBias.mode).toBe("immersive_showcase");
    expect(b.featuresBias.density).toBe("minimal");
    expect(b.proofBias.style).toBe("embedded_social_proof");
    expect(b.ctaBias.intensity).toBe("soft");
    expect(b.antiPatterns.length).toBeGreaterThanOrEqual(1);
    expect(b.antiPatterns.some((a) => a.includes("generic_saas"))).toBe(true);
  });

  it("commerce_dense → tight_conversion + campaign antiPatterns", () => {
    const b = buildPageCompositionBiasFromHeroExpression({ heroExpression: "commerce_dense" });
    expect(b.rhythmBias.mode).toBe("tight_conversion");
    expect(b.ctaBias.intensity).toBe("high");
    expect(b.proofBias.style).toBe("results_driven");
    expect(b.antiPatterns.some((a) => a.includes("primary_cta"))).toBe(true);
  });

  it("service_trust → stacked authority proof", () => {
    const b = buildPageCompositionBiasFromHeroExpression({ heroExpression: "service_trust" });
    expect(b.proofBias.style).toBe("stacked_authority");
    expect(b.rhythmBias.discourageEarlyPricing).toBe(true);
  });

  it("archetype verfijnt maar overschrijft basis niet volledig", () => {
    const base = buildPageCompositionBiasFromHeroExpression({ heroExpression: "editorial_calm" });
    const refined = buildPageCompositionBiasFromHeroExpression({
      heroExpression: "editorial_calm",
      aboveFoldArchetypeId: "dense_commerce_stage",
    });
    expect(refined.rhythmBias.mode).toBe(base.rhythmBias.mode);
    expect(refined.ctaBias.intensity).not.toBe("soft");
    expect(refined.proofBias.preferredTags.length).toBeGreaterThanOrEqual(base.proofBias.preferredTags.length);
  });
});
