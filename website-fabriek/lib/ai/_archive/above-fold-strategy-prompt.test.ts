import { describe, expect, it } from "vitest";
import { buildAboveFoldStrategyPromptBlock } from "@/lib/ai/above-fold-strategy-prompt";
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
    designRegime: "hero_split",
    ...overrides,
  };
}

describe("buildAboveFoldStrategyPromptBlock", () => {
  it("lage confidence → zachte taal in strategieblok", () => {
    const text = buildAboveFoldStrategyPromptBlock({
      siteIntent: minimalIntent({
        resolverConfidence: { level: "low", score: 0.3 },
      }),
      siteConfig: { prompt_interpretation_context: undefined },
      layoutOptions: {
        biasStrength: "soft",
        allowAggressiveNarrowing: false,
        allowArchetypeHardFilter: false,
        preferCompactFallbackPrompt: true,
      },
    });
    expect(text.toLowerCase()).toMatch(/zachte hint|veel vrijheid/);
  });

  it("hoge confidence → sterkere voorkeur (geen micromanagement)", () => {
    const text = buildAboveFoldStrategyPromptBlock({
      siteIntent: minimalIntent({
        resolverConfidence: { level: "high", score: 0.95 },
      }),
      siteConfig: { prompt_interpretation_context: undefined },
      layoutOptions: {
        biasStrength: "hard",
        allowAggressiveNarrowing: true,
        allowArchetypeHardFilter: true,
        preferCompactFallbackPrompt: true,
      },
    });
    expect(text.toLowerCase()).toMatch(/sterke.*voorkeur|afwijken mag/);
  });
});
