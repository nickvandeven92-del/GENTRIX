export type LayoutArchetype =
  | "hero_split_product"
  | "hero_centered_editorial"
  | "hero_asymmetric_bento"
  | "hero_dark_cinematic"
  | "hero_nav_split_product"
  | "hero_nav_centered_editorial"
  | "hero_nav_asymmetric_bento"
  | "hero_nav_dark_cinematic"
  | "features_bento"
  | "features_editorial_columns"
  | "features_timeline"
  | "features_split_visual_lead"
  | "testimonials_quote_wall"
  | "testimonials_carousel"
  | "testimonials_grid_showcase"
  | "testimonials_split_spotlight"
  | "cta_stacked_high_contrast"
  | "cta_floating_card"
  | "cta_split_media"
  | "content_sidebar_narrative"
  | "content_faq_accordion"
  | "content_faq_two_column"
  | "content_pricing_comparison"
  | "content_pricing_split_lead";

export type GridColumnCount = 1 | 2 | 3 | 4;
export type SpaceToken = 4 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 48;
export type MaxWidthToken =
  | "max-w-screen-sm"
  | "max-w-screen-md"
  | "max-w-screen-lg"
  | "max-w-screen-xl"
  | "max-w-screen-2xl"
  | "max-w-3xl"
  | "max-w-4xl"
  | "max-w-5xl"
  | "max-w-6xl"
  | "max-w-7xl";

export interface LayoutArchetypeConfig {
  gridColumns: {
    mobile: GridColumnCount;
    tablet: GridColumnCount;
    desktop: GridColumnCount;
  };
  slotOrder: string[];
  gap: {
    mobile: SpaceToken;
    desktop: SpaceToken;
  };
  verticalPadding: {
    mobile: SpaceToken;
    desktop: SpaceToken;
  };
  horizontalAlignment: "left" | "center" | "right" | "space-between";
  verticalAlignment: "top" | "center" | "bottom";
  mediaAspectRatio?: "1/1" | "4/3" | "16/9" | "21/9";
  mediaPosition?: "left" | "right" | "top" | "bottom" | "background";
  overlayOpacity?: number;
  maxWidthClass?: MaxWidthToken;
  columns?: GridColumnCount;
  stickyFirstChild?: boolean;
  parallaxEffect?: boolean;
}

export interface PresetLike {
  colors?: unknown;
  typography?: unknown;
  spacing?: unknown;
  container?: {
    className?: string;
  };
}

/** Volledige class-strings (Tailwind v4 JIT ziet dynamische template-strings niet). */
const GRID_COL_TRIPLE_CLASS: Record<string, string> = {
  "1-1-1": "grid-cols-1 md:grid-cols-1 lg:grid-cols-1",
  "1-2-2": "grid-cols-1 md:grid-cols-2 lg:grid-cols-2",
  "1-2-3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "1-3-4": "grid-cols-1 md:grid-cols-3 lg:grid-cols-4",
};

const GAP_PAIR_CLASS: Record<string, string> = {
  "4-4": "gap-4 md:gap-4",
  "4-6": "gap-4 md:gap-6",
  "4-8": "gap-4 md:gap-8",
  "6-8": "gap-6 md:gap-8",
  "6-10": "gap-6 md:gap-10",
  "8-10": "gap-8 md:gap-10",
  "8-12": "gap-8 md:gap-12",
  "8-16": "gap-8 md:gap-16",
};

const PADDING_Y_PAIR_CLASS: Record<string, string> = {
  "8-12": "py-8 md:py-12",
  "8-16": "py-8 md:py-16",
  "12-20": "py-12 md:py-20",
  "12-24": "py-12 md:py-24",
  "16-24": "py-16 md:py-24",
  "16-32": "py-16 md:py-32",
  "24-48": "py-24 md:py-48",
};

export function getGridColsClassTriple(
  mobile: GridColumnCount,
  tablet: GridColumnCount,
  desktop: GridColumnCount,
): string {
  const key = `${mobile}-${tablet}-${desktop}`;
  return GRID_COL_TRIPLE_CLASS[key] ?? GRID_COL_TRIPLE_CLASS["1-1-1"]!;
}

export function getGapPairClass(mobile: SpaceToken, desktop: SpaceToken): string {
  const key = `${mobile}-${desktop}`;
  return GAP_PAIR_CLASS[key] ?? GAP_PAIR_CLASS["6-8"]!;
}

export function getPaddingYPairClass(mobile: SpaceToken, desktop: SpaceToken): string {
  const key = `${mobile}-${desktop}`;
  return PADDING_Y_PAIR_CLASS[key] ?? PADDING_Y_PAIR_CLASS["12-24"]!;
}

const ORDER_CLASS_MAP: Record<number, string> = {
  1: "order-1",
  2: "order-2",
  3: "order-3",
  4: "order-4",
  5: "order-5",
  6: "order-6",
  7: "order-7",
  8: "order-8",
  9: "order-9",
  10: "order-10",
  11: "order-11",
  12: "order-12",
};

export function getOrderClass(order: number): string {
  return ORDER_CLASS_MAP[order] ?? "order-none";
}

export const LAYOUT_ARCHETYPES: Record<LayoutArchetype, LayoutArchetypeConfig> = {
  hero_split_product: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["media", "content"],
    gap: { mobile: 8, desktop: 16 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "space-between",
    verticalAlignment: "center",
    mediaAspectRatio: "4/3",
    mediaPosition: "right",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  hero_centered_editorial: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["eyebrow", "headline", "subheadline", "cta"],
    gap: { mobile: 4, desktop: 6 },
    verticalPadding: { mobile: 16, desktop: 32 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    maxWidthClass: "max-w-4xl",
    columns: 1,
  },

  hero_asymmetric_bento: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["featured", "supporting", "cta"],
    gap: { mobile: 4, desktop: 8 },
    verticalPadding: { mobile: 8, desktop: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    mediaAspectRatio: "1/1",
    mediaPosition: "left",
    stickyFirstChild: true,
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  hero_dark_cinematic: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["overlay", "headline", "cta"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 24, desktop: 48 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    mediaPosition: "background",
    overlayOpacity: 0.6,
    maxWidthClass: "max-w-6xl",
    parallaxEffect: true,
    columns: 1,
  },

  /** Nav als eerste slot (full-width); daarna zelfde ritme als split hero — HTML gebruikt inner grid md:grid-cols-2 voor media+content. */
  hero_nav_split_product: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["navigation", "media", "content"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "center",
    mediaAspectRatio: "4/3",
    mediaPosition: "right",
    maxWidthClass: "max-w-screen-2xl",
    columns: 1,
  },

  hero_nav_centered_editorial: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["navigation", "eyebrow", "headline", "subheadline", "cta"],
    gap: { mobile: 4, desktop: 6 },
    verticalPadding: { mobile: 16, desktop: 32 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    maxWidthClass: "max-w-4xl",
    columns: 1,
  },

  hero_nav_asymmetric_bento: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["navigation", "featured", "supporting", "cta"],
    gap: { mobile: 4, desktop: 8 },
    verticalPadding: { mobile: 8, desktop: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    mediaAspectRatio: "1/1",
    mediaPosition: "left",
    stickyFirstChild: false,
    maxWidthClass: "max-w-screen-2xl",
    columns: 1,
  },

  hero_nav_dark_cinematic: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["navigation", "overlay", "headline", "cta"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 16, desktop: 32 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    mediaPosition: "background",
    overlayOpacity: 0.55,
    maxWidthClass: "max-w-6xl",
    parallaxEffect: true,
    columns: 1,
  },

  features_bento: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 3 },
    slotOrder: ["title", "description", "icon"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "center",
    verticalAlignment: "top",
    columns: 3,
    maxWidthClass: "max-w-screen-2xl",
  },

  features_editorial_columns: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["aside", "features-grid"],
    gap: { mobile: 8, desktop: 16 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    columns: 2,
    stickyFirstChild: true,
    maxWidthClass: "max-w-screen-2xl",
  },

  features_timeline: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["year", "title", "description"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    maxWidthClass: "max-w-6xl",
    columns: 2,
  },

  features_split_visual_lead: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["visual_intro", "feature_grid"],
    gap: { mobile: 8, desktop: 16 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    mediaAspectRatio: "4/3",
    mediaPosition: "left",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  testimonials_quote_wall: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 3 },
    slotOrder: ["quote", "avatar", "name", "role"],
    gap: { mobile: 8, desktop: 10 },
    verticalPadding: { mobile: 16, desktop: 32 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    columns: 3,
    maxWidthClass: "max-w-screen-2xl",
  },

  testimonials_carousel: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["active-quote", "navigation", "dots"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 16, desktop: 24 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    maxWidthClass: "max-w-5xl",
    columns: 1,
  },

  testimonials_grid_showcase: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 4 },
    slotOrder: ["testimonial-card"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "center",
    verticalAlignment: "top",
    columns: 4,
    maxWidthClass: "max-w-screen-2xl",
  },

  testimonials_split_spotlight: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["spotlight_quote", "supporting_stack"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 16, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  cta_stacked_high_contrast: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["headline", "subheadline", "buttons"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 16, desktop: 32 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    maxWidthClass: "max-w-5xl",
    columns: 1,
  },

  cta_floating_card: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["card-content", "cta-button"],
    gap: { mobile: 4, desktop: 6 },
    verticalPadding: { mobile: 8, desktop: 12 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    maxWidthClass: "max-w-3xl",
    columns: 1,
  },

  cta_split_media: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["media", "content"],
    gap: { mobile: 8, desktop: 16 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "space-between",
    verticalAlignment: "center",
    mediaAspectRatio: "16/9",
    mediaPosition: "left",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  content_sidebar_narrative: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["main", "sidebar"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 8, desktop: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    stickyFirstChild: true,
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  content_faq_accordion: {
    gridColumns: { mobile: 1, tablet: 1, desktop: 1 },
    slotOrder: ["faq-items"],
    gap: { mobile: 4, desktop: 4 },
    verticalPadding: { mobile: 12, desktop: 20 },
    horizontalAlignment: "center",
    verticalAlignment: "top",
    maxWidthClass: "max-w-5xl",
    columns: 1,
  },

  content_faq_two_column: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["intro", "faq_left", "faq_right"],
    gap: { mobile: 6, desktop: 8 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },

  content_pricing_comparison: {
    gridColumns: { mobile: 1, tablet: 3, desktop: 4 },
    slotOrder: ["plan-card"],
    gap: { mobile: 4, desktop: 6 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "center",
    verticalAlignment: "top",
    columns: 4,
    maxWidthClass: "max-w-screen-2xl",
  },

  content_pricing_split_lead: {
    gridColumns: { mobile: 1, tablet: 2, desktop: 2 },
    slotOrder: ["intro", "plans_grid"],
    gap: { mobile: 8, desktop: 12 },
    verticalPadding: { mobile: 12, desktop: 24 },
    horizontalAlignment: "left",
    verticalAlignment: "top",
    maxWidthClass: "max-w-screen-2xl",
    columns: 2,
  },
};

export function getLayoutWithPreset(layout: LayoutArchetype, presetConfig: PresetLike) {
  const layoutConfig = LAYOUT_ARCHETYPES[layout];

  return {
    gridColumns: layoutConfig.gridColumns,
    gap: layoutConfig.gap,
    padding: layoutConfig.verticalPadding,
    alignment: {
      horizontal: layoutConfig.horizontalAlignment,
      vertical: layoutConfig.verticalAlignment,
    },
    colors: presetConfig.colors,
    typography: presetConfig.typography,
    spacing: presetConfig.spacing,
    media: {
      aspectRatio: layoutConfig.mediaAspectRatio,
      position: layoutConfig.mediaPosition,
      overlay: layoutConfig.overlayOpacity,
      parallax: layoutConfig.parallaxEffect,
      sticky: layoutConfig.stickyFirstChild,
    },
    slotOrder: layoutConfig.slotOrder,
    maxWidthClass: layoutConfig.maxWidthClass,
  };
}

export function isLayoutArchetype(value: string): value is LayoutArchetype {
  return value in LAYOUT_ARCHETYPES;
}
