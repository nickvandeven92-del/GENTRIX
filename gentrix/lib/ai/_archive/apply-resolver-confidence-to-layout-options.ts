import type { ResolverConfidence } from "@/lib/ai/site-experience-model";

export type LayoutBiasStrength = "soft" | "balanced" | "hard";

export type ResolverConfidenceLayoutOptions = {
  biasStrength: LayoutBiasStrength;
  allowAggressiveNarrowing: boolean;
  allowArchetypeHardFilter: boolean;
  preferCompactFallbackPrompt: boolean;
};

/**
 * Zet resolver-betrouwbaarheid om in layout-bias. `preferCompactFallbackPrompt` is altijd **true**:
 * lange above-fold interpretatieblokken micromanagen het model; korte hint + STUDIO volstaat en geeft meer vrijheid.
 */
export function applyResolverConfidenceToLayoutOptions(
  confidence?: ResolverConfidence | null,
): ResolverConfidenceLayoutOptions {
  const compact = { preferCompactFallbackPrompt: true as const };

  if (!confidence) {
    return {
      biasStrength: "balanced",
      allowAggressiveNarrowing: false,
      allowArchetypeHardFilter: false,
      ...compact,
    };
  }

  const { level, score } = confidence;

  if (level === "high" || score >= 0.8) {
    return {
      biasStrength: "hard",
      allowAggressiveNarrowing: true,
      allowArchetypeHardFilter: true,
      ...compact,
    };
  }

  if (level === "low" || score < 0.45) {
    return {
      biasStrength: "soft",
      allowAggressiveNarrowing: false,
      allowArchetypeHardFilter: false,
      ...compact,
    };
  }

  return {
    biasStrength: "balanced",
    allowAggressiveNarrowing: false,
    allowArchetypeHardFilter: false,
    ...compact,
  };
}
