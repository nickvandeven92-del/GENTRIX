export type PageLengthTarget = "compact" | "balanced" | "extended";

export type SectionDensity = "tight" | "normal" | "airy";

export type ContentCompression = "aggressive" | "moderate" | "relaxed";

export type CompactnessProfile = {
  pageLengthTarget: PageLengthTarget;
  sectionDensity: SectionDensity;
  contentCompression: ContentCompression;

  maxPrimarySections: number;
  maxCtaSections: number;
  maxNarrativeSections: number;
  maxCardGridSections: number;

  maxCardsPerSection: number;
  maxBulletsPerCard: number;
  maxParagraphSentences: number;
  maxParagraphChars: number;

  allowDedicatedAboutSection: boolean;
  allowLargeFooter: boolean;
  preferMergedSections: boolean;
  preferHeroWithEmbeddedProof: boolean;
  preferInlineContactOverFullForm: boolean;

  desktopSectionPaddingY: string;
  mobileSectionPaddingY: string;
  cardPadding: string;
  containerMaxWidth: string;
};
