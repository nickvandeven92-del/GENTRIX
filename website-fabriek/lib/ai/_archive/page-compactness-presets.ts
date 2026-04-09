import type { CompactnessProfile, PageLengthTarget } from "@/types/pageCompactness";

export const COMPACTNESS_PRESETS: Record<PageLengthTarget, CompactnessProfile> = {
  compact: {
    pageLengthTarget: "compact",
    sectionDensity: "tight",
    contentCompression: "aggressive",

    maxPrimarySections: 3,
    maxCtaSections: 1,
    maxNarrativeSections: 1,
    maxCardGridSections: 1,

    maxCardsPerSection: 3,
    maxBulletsPerCard: 2,
    maxParagraphSentences: 2,
    maxParagraphChars: 180,

    allowDedicatedAboutSection: false,
    allowLargeFooter: false,
    preferMergedSections: true,
    preferHeroWithEmbeddedProof: true,
    preferInlineContactOverFullForm: true,

    desktopSectionPaddingY: "py-16 lg:py-20",
    mobileSectionPaddingY: "py-12",
    cardPadding: "p-6 lg:p-7",
    containerMaxWidth: "max-w-6xl",
  },

  balanced: {
    pageLengthTarget: "balanced",
    sectionDensity: "normal",
    contentCompression: "moderate",

    maxPrimarySections: 4,
    maxCtaSections: 1,
    maxNarrativeSections: 1,
    maxCardGridSections: 2,

    maxCardsPerSection: 4,
    maxBulletsPerCard: 3,
    maxParagraphSentences: 3,
    maxParagraphChars: 260,

    allowDedicatedAboutSection: true,
    allowLargeFooter: false,
    preferMergedSections: true,
    preferHeroWithEmbeddedProof: true,
    preferInlineContactOverFullForm: false,

    desktopSectionPaddingY: "py-20 lg:py-24",
    mobileSectionPaddingY: "py-14",
    cardPadding: "p-7 lg:p-8",
    containerMaxWidth: "max-w-7xl",
  },

  extended: {
    pageLengthTarget: "extended",
    sectionDensity: "airy",
    contentCompression: "relaxed",

    maxPrimarySections: 6,
    maxCtaSections: 2,
    maxNarrativeSections: 2,
    maxCardGridSections: 2,

    maxCardsPerSection: 6,
    maxBulletsPerCard: 4,
    maxParagraphSentences: 4,
    maxParagraphChars: 360,

    allowDedicatedAboutSection: true,
    allowLargeFooter: true,
    preferMergedSections: false,
    preferHeroWithEmbeddedProof: false,
    preferInlineContactOverFullForm: false,

    desktopSectionPaddingY: "py-24 lg:py-32",
    mobileSectionPaddingY: "py-16",
    cardPadding: "p-8 lg:p-10",
    containerMaxWidth: "max-w-7xl",
  },
};

export function getCompactnessPreset(target: PageLengthTarget): CompactnessProfile {
  return COMPACTNESS_PRESETS[target];
}
