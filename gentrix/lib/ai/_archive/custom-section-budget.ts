import type { CompactnessProfile, PageLengthTarget } from "@/types/pageCompactness";

export type CustomSectionPolicy = {
  maxCustomSections: number;
  /** Alleen van toepassing als huidige `pageLengthTarget` in deze set zit (defensief). */
  keepCustomSectionsForTargets: PageLengthTarget[];
};

export function resolveCustomSectionPolicy(compactness: CompactnessProfile): CustomSectionPolicy {
  if (compactness.pageLengthTarget === "compact") {
    return {
      maxCustomSections: 1,
      keepCustomSectionsForTargets: ["compact", "balanced", "extended"],
    };
  }

  if (compactness.pageLengthTarget === "balanced") {
    return {
      maxCustomSections: 2,
      keepCustomSectionsForTargets: ["balanced", "extended"],
    };
  }

  return {
    maxCustomSections: 4,
    keepCustomSectionsForTargets: ["compact", "balanced", "extended"],
  };
}

export function limitCustomSections(
  customSectionIds: string[],
  compactness: CompactnessProfile,
): string[] {
  const policy = resolveCustomSectionPolicy(compactness);

  if (!policy.keepCustomSectionsForTargets.includes(compactness.pageLengthTarget)) {
    return [];
  }

  return [...new Set(customSectionIds)].slice(0, policy.maxCustomSections);
}
