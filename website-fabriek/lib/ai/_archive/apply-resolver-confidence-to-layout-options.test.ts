import { describe, expect, it } from "vitest";
import { applyResolverConfidenceToLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";

describe("applyResolverConfidenceToLayoutOptions", () => {
  it("high level → hard + narrowing + archetype filter + altijd compacte ATF-prompt", () => {
    const o = applyResolverConfidenceToLayoutOptions({ level: "high", score: 0.5 });
    expect(o).toEqual({
      biasStrength: "hard",
      allowAggressiveNarrowing: true,
      allowArchetypeHardFilter: true,
      preferCompactFallbackPrompt: true,
    });
  });

  it("score >= 0.8 → hard ook bij medium level", () => {
    const o = applyResolverConfidenceToLayoutOptions({ level: "medium", score: 0.85 });
    expect(o.biasStrength).toBe("hard");
    expect(o.allowAggressiveNarrowing).toBe(true);
  });

  it("low level → soft + compact fallback", () => {
    const o = applyResolverConfidenceToLayoutOptions({ level: "low", score: 0.5 });
    expect(o).toEqual({
      biasStrength: "soft",
      allowAggressiveNarrowing: false,
      allowArchetypeHardFilter: false,
      preferCompactFallbackPrompt: true,
    });
  });

  it("score < 0.45 → soft", () => {
    const o = applyResolverConfidenceToLayoutOptions({ level: "medium", score: 0.4 });
    expect(o.biasStrength).toBe("soft");
    expect(o.preferCompactFallbackPrompt).toBe(true);
  });

  it("medium band → balanced + compact ATF", () => {
    const o = applyResolverConfidenceToLayoutOptions({ level: "medium", score: 0.55 });
    expect(o).toEqual({
      biasStrength: "balanced",
      allowAggressiveNarrowing: false,
      allowArchetypeHardFilter: false,
      preferCompactFallbackPrompt: true,
    });
  });

  it("null/undefined → balanced default + compact ATF", () => {
    expect(applyResolverConfidenceToLayoutOptions(null).biasStrength).toBe("balanced");
    expect(applyResolverConfidenceToLayoutOptions(null).preferCompactFallbackPrompt).toBe(true);
    expect(applyResolverConfidenceToLayoutOptions(undefined).biasStrength).toBe("balanced");
    expect(applyResolverConfidenceToLayoutOptions(undefined).preferCompactFallbackPrompt).toBe(true);
  });
});
