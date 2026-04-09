import { describe, expect, it } from "vitest";
import { resolveCompositionPlan } from "@/lib/ai/resolve-composition-plan";
import type { SiteIntent } from "@/lib/ai/site-experience-model";

function minimalIntent(overrides: Partial<SiteIntent>): SiteIntent {
  return {
    experienceModel: "saas_landing",
    navigationDepth: "standard",
    densityProfile: "balanced",
    conversionModel: "lead_capture",
    searchImportance: "none",
    trustStyle: "subtle",
    contentStrategy: "low",
    businessModel: "Test",
    recommendedHomepagePattern: ["a", "b"],
    ...overrides,
  };
}

describe("resolveCompositionPlan", () => {
  it("levert layoutOptions en pageCompositionBias", () => {
    const r = resolveCompositionPlan({
      siteIntent: minimalIntent({
        heroExpression: "split_clear",
        resolverConfidence: { level: "medium", score: 0.55 },
      }),
    });
    expect(r.layoutOptions.biasStrength).toBe("balanced");
    expect(r.pageCompositionBias.featuresBias.density).toBe("curated");
    expect(r.conflictsResolved).toEqual([]);
    expect(r.conflictDecisions).toEqual([]);
  });

  it("normaliseert editorial + dense commerce archetype", () => {
    const r = resolveCompositionPlan({
      siteIntent: minimalIntent({
        heroExpression: "editorial_calm",
        aboveFoldArchetypeId: "dense_commerce_stage",
        resolverConfidence: { level: "high", score: 0.9 },
      }),
    });
    expect(r.normalizedSiteIntent.aboveFoldArchetypeId).toBe("editorial_full_bleed");
    expect(r.conflictDecisions.length).toBe(1);
    expect(r.conflictDecisions[0]!.winningSignal).toContain("heroExpression:editorial_calm");
    expect(r.conflictDecisions[0]!.suppressedSignal).toBe(
      "aboveFoldArchetypeId:dense_commerce_stage",
    );
    expect(r.conflictsResolved[0]).toContain("dominance:");
    expect(r.conflictsResolved[0]).toContain("heroExpression:editorial_calm");
  });

  it("normaliseert service_trust + campaign archetype", () => {
    const r = resolveCompositionPlan({
      siteIntent: minimalIntent({
        heroExpression: "service_trust",
        aboveFoldArchetypeId: "integrated_campaign_media",
      }),
    });
    expect(r.normalizedSiteIntent.aboveFoldArchetypeId).toBe("service_conversational");
    expect(r.conflictDecisions.length).toBe(1);
    expect(r.conflictDecisions[0]!.winningSignal).toBe("heroExpression:service_trust");
  });
});
