import type { CompactnessProfile } from "@/types/pageCompactness";

export type RenderConstraints = {
  forceEqualHeightCards: boolean;
  preferShortCards: boolean;
  maxCardBodyLines: number;
  maxListItems: number;
  sectionGapClass: string;
  sectionPaddingDesktop: string;
  sectionPaddingMobile: string;
  cardPadding: string;
  containerMaxWidth: string;
};

export function resolveRenderConstraints(compactness: CompactnessProfile): RenderConstraints {
  const isCompact = compactness.pageLengthTarget === "compact";
  const isExtended = compactness.pageLengthTarget === "extended";

  return {
    forceEqualHeightCards: isExtended,
    preferShortCards: isCompact,
    maxCardBodyLines: isCompact ? 4 : isExtended ? 6 : 5,
    maxListItems: compactness.maxBulletsPerCard,
    sectionGapClass: isCompact ? "gap-6 lg:gap-8" : isExtended ? "gap-10 lg:gap-12" : "gap-8 lg:gap-10",
    sectionPaddingDesktop: compactness.desktopSectionPaddingY,
    sectionPaddingMobile: compactness.mobileSectionPaddingY,
    cardPadding: compactness.cardPadding,
    containerMaxWidth: compactness.containerMaxWidth,
  };
}
