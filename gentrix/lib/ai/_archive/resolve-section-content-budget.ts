import type { CompactnessProfile } from "@/types/pageCompactness";
import type { SectionContentBudget } from "@/types/sectionContentBudget";

export function resolveSectionContentBudget(compactness: CompactnessProfile): SectionContentBudget {
  if (compactness.pageLengthTarget === "compact") {
    return {
      maxItems: 3,
      maxBulletsPerItem: 2,
      maxBodyChars: 180,
      maxStats: 3,
      maxFaqItems: 4,
      maxTestimonials: 3,
      maxPortfolioItems: 4,
      maxNavLinks: 5,
      maxFooterColumns: 2,
    };
  }

  if (compactness.pageLengthTarget === "balanced") {
    return {
      maxItems: 4,
      maxBulletsPerItem: 3,
      maxBodyChars: 260,
      maxStats: 4,
      maxFaqItems: 6,
      maxTestimonials: 4,
      maxPortfolioItems: 6,
      maxNavLinks: 6,
      maxFooterColumns: 3,
    };
  }

  return {
    maxItems: 6,
    maxBulletsPerItem: 4,
    maxBodyChars: 360,
    maxStats: 6,
    maxFaqItems: 8,
    maxTestimonials: 6,
    maxPortfolioItems: 8,
    maxNavLinks: 8,
    maxFooterColumns: 4,
  };
}
