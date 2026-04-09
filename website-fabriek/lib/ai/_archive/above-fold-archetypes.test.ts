import { describe, expect, it } from "vitest";
import {
  getEffectiveHeroExpression,
  resolveFinalDesignRegime,
} from "@/lib/ai/above-fold-archetypes";
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

describe("resolveFinalDesignRegime", () => {
  it("vouwt hero_mixed in naar integrated voor editorial/brand/premium", () => {
    const i = minimalIntent({
      experienceModel: "brand_storytelling",
      designRegime: "hero_mixed",
    });
    expect(resolveFinalDesignRegime(i)).toBe("hero_integrated");
  });

  it("vouwt hero_mixed in naar split voor saas_landing", () => {
    const i = minimalIntent({
      experienceModel: "saas_landing",
      designRegime: "hero_mixed",
    });
    expect(resolveFinalDesignRegime(i)).toBe("hero_split");
  });

  it("laat expliciet hero_split ongemoeid", () => {
    const i = minimalIntent({ designRegime: "hero_split" });
    expect(resolveFinalDesignRegime(i)).toBe("hero_split");
  });
});

describe("getEffectiveHeroExpression fallback", () => {
  it("gebruikt geen balanced_mixed wanneer regime gemixed maar resolved split is", () => {
    const i = minimalIntent({
      experienceModel: "saas_landing",
      designRegime: "hero_mixed",
    });
    expect(getEffectiveHeroExpression(i)).toBe("split_clear");
  });
});
