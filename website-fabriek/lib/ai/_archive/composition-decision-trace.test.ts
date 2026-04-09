import { describe, expect, it } from "vitest";
import {
  assessCompositionBlandnessRisk,
  buildCompositionDecisionTrace,
} from "@/lib/ai/composition-decision-trace";
import type { CompositionConflictDecision } from "@/lib/ai/resolve-composition-plan";
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

describe("buildCompositionDecisionTrace", () => {
  it("vult trace + topSuppressedAlternatives", () => {
    const decisions: CompositionConflictDecision[] = [
      {
        winningSignal: "heroExpression:editorial_calm",
        suppressedSignal: "aboveFoldArchetypeId:dense_commerce_stage",
        reason: "test",
      },
    ];
    const intent = minimalIntent({
      heroExpression: "editorial_calm",
      aboveFoldArchetypeId: "editorial_full_bleed",
      resolverConfidence: { level: "high", score: 0.9 },
    });
    const t = buildCompositionDecisionTrace({
      normalizedSiteIntent: intent,
      layoutOptions: {
        biasStrength: "hard",
        allowAggressiveNarrowing: true,
        allowArchetypeHardFilter: true,
        preferCompactFallbackPrompt: false,
      },
      finalDesignRegime: "hero_integrated",
      effectiveHeroExpression: "editorial_calm",
      conflictDecisions: decisions,
      compactPromptUsed: false,
    });
    expect(t.narrowingMode).toBe("hard");
    expect(t.compactPromptUsed).toBe(false);
    expect(t.topSuppressedAlternatives[0]).toContain("dense_commerce_stage");
    expect(t.finalDesignRegime).toBe("hero_integrated");
  });
});

describe("assessCompositionBlandnessRisk", () => {
  it("waarschuwt bij soft + balanced_mixed + safe archetype", () => {
    const w = assessCompositionBlandnessRisk({
      biasStrength: "soft",
      effectiveHeroExpression: "balanced_mixed",
      aboveFoldArchetypeId: "minimal_statement",
      conflictDecisionCount: 0,
    });
    expect(w).toBeDefined();
    expect(w).toContain("overly_neutralized");
  });

  it("geen waarschuwing bij hard confidence", () => {
    expect(
      assessCompositionBlandnessRisk({
        biasStrength: "hard",
        effectiveHeroExpression: "balanced_mixed",
        aboveFoldArchetypeId: "minimal_statement",
        conflictDecisionCount: 0,
      }),
    ).toBeUndefined();
  });
});
