import {
  experienceModelLayoutGroup,
  getEffectiveHeroExpression,
  resolveFinalDesignRegime,
} from "@/lib/ai/above-fold-archetypes";
import {
  applyResolverConfidenceToLayoutOptions,
  type ResolverConfidenceLayoutOptions,
} from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import {
  biasCtaPoolByPageComposition,
  biasFeaturesPoolByPageComposition,
  biasHeroPoolByDesignRegimeWithStrength,
  biasHeroPoolByHeroExpressionWithStrength,
  biasTestimonialsPoolByPageComposition,
} from "@/lib/ai/apply-layout-pool-bias";
import type { CompositionDebugPayload } from "@/lib/ai/composition-debug-payload";
import { buildPageCompositionBiasFromHeroExpression } from "@/lib/ai/page-composition-bias";
import type { PageCompositionBias } from "@/lib/ai/page-composition-bias";
import type { SiteConfig } from "@/lib/ai/build-site-config";
import type { DesignPersonality } from "@/lib/ai/design-personality";
import type { HomepagePlan, PageCompositionArchetype } from "@/lib/ai/build-homepage-plan";
import type { ThemeMode } from "@/lib/ai/design-presets";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

function fnv1aHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T extends readonly LayoutArchetype[]>(pool: T, salt: string, sectionKey: string): T[number] {
  if (pool.length === 0) {
    throw new Error("studio-prompt-layout-maps: empty archetype pool");
  }
  const h = fnv1aHash(`${salt}\n${sectionKey}`);
  return pool[h % pool.length]!;
}

const HERO_BASE_LIGHT: readonly LayoutArchetype[] = [
  "hero_split_product",
  "hero_centered_editorial",
  "hero_asymmetric_bento",
];

const HERO_NAV_LIGHT: readonly LayoutArchetype[] = [
  "hero_nav_split_product",
  "hero_nav_centered_editorial",
  "hero_nav_asymmetric_bento",
];

/** Optionele cinematic helden — geen verplichting; \`elegant_luxury\` gebruikt vaak lichte splits/editorial. */
const HERO_DARK: readonly LayoutArchetype[] = ["hero_dark_cinematic", "hero_nav_dark_cinematic"];

function heroPoolForTheme(themeMode: ThemeMode | undefined): readonly LayoutArchetype[] {
  const navMix = [...HERO_BASE_LIGHT, ...HERO_NAV_LIGHT];
  if (themeMode === "light") {
    return navMix;
  }
  if (themeMode === "dark") {
    return [...navMix, ...HERO_DARK];
  }
  return [...navMix, ...HERO_DARK];
}

const PERSONALITY_HERO_MAP: Record<DesignPersonality, readonly LayoutArchetype[]> = {
  bold_industrial: ["hero_dark_cinematic", "hero_nav_dark_cinematic"],
  elegant_luxury: ["hero_split_product", "hero_asymmetric_bento"],
  playful_creative: ["hero_nav_asymmetric_bento", "hero_asymmetric_bento"],
  /** Meer dan split+centered — voorkomt “elke minimal_tech-site ziet er hetzelfde uit”. */
  minimal_tech: [
    "hero_centered_editorial",
    "hero_nav_centered_editorial",
    "hero_nav_split_product",
    "hero_split_product",
    "hero_nav_asymmetric_bento",
    "hero_asymmetric_bento",
  ],
  editorial_art: ["hero_nav_centered_editorial", "hero_centered_editorial"],
  trust_conversion: ["hero_nav_split_product", "hero_split_product"],
};

/** Kruising personality × theme: geen donkere cinematic op enforced light preset. */
function resolveHeroPool(
  personality: DesignPersonality,
  themeMode: ThemeMode | undefined,
): LayoutArchetype[] {
  const fromPersonality = [...PERSONALITY_HERO_MAP[personality]];
  const fromTheme = [...heroPoolForTheme(themeMode)];
  const inter = fromPersonality.filter((a) => fromTheme.includes(a));
  return inter.length > 0 ? inter : fromTheme;
}

function preferArchetypesInPool(
  preferred: readonly LayoutArchetype[],
  pool: LayoutArchetype[],
): LayoutArchetype[] {
  const hit = preferred.filter((a) => pool.includes(a));
  return hit.length > 0 ? hit : pool;
}

/**
 * Macro `compositionPlan.layoutArchetype` beperkt/herordent pools **vóór** per-sectie `pick` —
 * sectie-`_layout_archetypes` blijven concrete `data-layout`-keuzes, maar volgen deze pagina-houding.
 */
function narrowHeroPoolForCompositionMacro(
  macro: PageCompositionArchetype,
  pool: LayoutArchetype[],
): LayoutArchetype[] {
  const byMacro: Record<PageCompositionArchetype, readonly LayoutArchetype[]> = {
    commerce_discovery_stack: [
      "hero_nav_split_product",
      "hero_split_product",
      "hero_asymmetric_bento",
      "hero_nav_asymmetric_bento",
    ],
    catalog_search_spine: [
      "hero_nav_centered_editorial",
      "hero_centered_editorial",
      "hero_nav_split_product",
      "hero_split_product",
    ],
    editorial_wave: [
      "hero_nav_centered_editorial",
      "hero_centered_editorial",
      "hero_nav_asymmetric_bento",
      "hero_asymmetric_bento",
    ],
    saas_proof_ladder: [
      "hero_nav_split_product",
      "hero_split_product",
      "hero_nav_centered_editorial",
      "hero_centered_editorial",
    ],
    service_trust_cta: [
      "hero_nav_split_product",
      "hero_split_product",
      "hero_centered_editorial",
      "hero_nav_centered_editorial",
      "hero_nav_asymmetric_bento",
      "hero_asymmetric_bento",
    ],
    premium_breath: [
      "hero_split_product",
      "hero_asymmetric_bento",
      "hero_centered_editorial",
      "hero_nav_centered_editorial",
    ],
    health_authority_stack: ["hero_centered_editorial", "hero_nav_centered_editorial"],
    hybrid_story_commerce: [
      "hero_nav_asymmetric_bento",
      "hero_nav_centered_editorial",
      "hero_nav_split_product",
    ],
    brand_chapter_scroll: [
      "hero_centered_editorial",
      "hero_nav_centered_editorial",
      "hero_asymmetric_bento",
    ],
    community_momentum: [
      "hero_nav_asymmetric_bento",
      "hero_asymmetric_bento",
      "hero_nav_dark_cinematic",
      "hero_dark_cinematic",
    ],
    default_professional: [],
  };
  const pref = byMacro[macro];
  if (!pref.length) return pool;
  return preferArchetypesInPool(pref, pool);
}

function narrowFeaturesPoolForCompositionMacro(
  macro: PageCompositionArchetype,
  pool: LayoutArchetype[],
): LayoutArchetype[] {
  const byMacro: Record<PageCompositionArchetype, readonly LayoutArchetype[]> = {
    commerce_discovery_stack: ["features_bento", "features_split_visual_lead", "features_timeline"],
    catalog_search_spine: ["features_split_visual_lead", "features_bento", "features_editorial_columns"],
    editorial_wave: ["features_editorial_columns", "features_split_visual_lead", "features_timeline"],
    saas_proof_ladder: ["features_editorial_columns", "features_bento", "features_split_visual_lead"],
    service_trust_cta: [
      "features_split_visual_lead",
      "features_editorial_columns",
      "features_bento",
      "features_timeline",
    ],
    premium_breath: ["features_bento", "features_editorial_columns", "features_split_visual_lead"],
    health_authority_stack: ["features_editorial_columns", "features_timeline", "features_split_visual_lead"],
    hybrid_story_commerce: ["features_split_visual_lead", "features_editorial_columns", "features_bento"],
    brand_chapter_scroll: ["features_timeline", "features_split_visual_lead", "features_editorial_columns"],
    community_momentum: ["features_bento", "features_split_visual_lead", "features_timeline"],
    default_professional: [],
  };
  const pref = byMacro[macro];
  if (!pref.length) return pool;
  return preferArchetypesInPool(pref, pool);
}

function narrowTestimonialsPoolForCompositionMacro(
  macro: PageCompositionArchetype,
  pool: readonly LayoutArchetype[],
): LayoutArchetype[] {
  const base = [...pool];
  const byMacro: Record<PageCompositionArchetype, readonly LayoutArchetype[]> = {
    commerce_discovery_stack: ["testimonials_grid_showcase", "testimonials_carousel"],
    catalog_search_spine: ["testimonials_grid_showcase", "testimonials_quote_wall"],
    editorial_wave: ["testimonials_split_spotlight", "testimonials_quote_wall"],
    saas_proof_ladder: ["testimonials_grid_showcase", "testimonials_split_spotlight"],
    service_trust_cta: ["testimonials_grid_showcase", "testimonials_split_spotlight", "testimonials_quote_wall"],
    premium_breath: ["testimonials_split_spotlight", "testimonials_carousel"],
    health_authority_stack: ["testimonials_split_spotlight", "testimonials_quote_wall"],
    hybrid_story_commerce: ["testimonials_split_spotlight", "testimonials_grid_showcase"],
    brand_chapter_scroll: ["testimonials_quote_wall", "testimonials_split_spotlight"],
    community_momentum: ["testimonials_grid_showcase", "testimonials_quote_wall"],
    default_professional: [],
  };
  const pref = byMacro[macro];
  if (!pref.length) return base;
  return preferArchetypesInPool(pref, base);
}

function narrowPricingPoolForCompositionMacro(
  macro: PageCompositionArchetype,
  pool: readonly LayoutArchetype[],
): LayoutArchetype[] {
  const base = [...pool];
  const byMacro: Record<PageCompositionArchetype, readonly LayoutArchetype[]> = {
    commerce_discovery_stack: ["content_pricing_comparison", "content_pricing_split_lead"],
    catalog_search_spine: ["content_pricing_comparison", "content_pricing_split_lead"],
    editorial_wave: ["content_pricing_split_lead", "content_pricing_comparison"],
    saas_proof_ladder: ["content_pricing_comparison", "content_pricing_split_lead"],
    service_trust_cta: ["content_pricing_split_lead", "content_pricing_comparison"],
    premium_breath: ["content_pricing_split_lead", "content_pricing_comparison"],
    health_authority_stack: ["content_pricing_split_lead", "content_pricing_comparison"],
    hybrid_story_commerce: ["content_pricing_split_lead", "content_pricing_comparison"],
    brand_chapter_scroll: ["content_pricing_split_lead", "content_pricing_comparison"],
    community_momentum: ["content_pricing_comparison", "content_pricing_split_lead"],
    default_professional: [],
  };
  const pref = byMacro[macro];
  if (!pref.length) return base;
  return preferArchetypesInPool(pref, base);
}

function biasHeroPoolForExperience(
  pool: LayoutArchetype[],
  group: ReturnType<typeof experienceModelLayoutGroup>,
): LayoutArchetype[] {
  if (group === "commerce") {
    const pref = ["hero_nav_split_product", "hero_split_product", "hero_asymmetric_bento"] as const;
    const hit = pref.filter((a) => pool.includes(a));
    return hit.length > 0 ? [...hit] : pool;
  }
  if (group === "editorial") {
    const pref = ["hero_nav_centered_editorial", "hero_centered_editorial", "hero_nav_asymmetric_bento"] as const;
    const hit = pref.filter((a) => pool.includes(a));
    return hit.length > 0 ? [...hit] : pool;
  }
  return pool;
}

function resolveFeaturesPoolForExperience(
  personality: DesignPersonality,
  group: ReturnType<typeof experienceModelLayoutGroup>,
): readonly LayoutArchetype[] {
  const base = PERSONALITY_FEATURES_MAP[personality];
  if (group === "commerce") {
    const order = [
      "features_bento",
      "features_split_visual_lead",
      "features_timeline",
      "features_editorial_columns",
    ] as const;
    const hit = order.filter((a) => base.includes(a));
    return hit.length > 0 ? hit : base;
  }
  if (group === "editorial") {
    const order = [
      "features_editorial_columns",
      "features_split_visual_lead",
      "features_timeline",
      "features_bento",
    ] as const;
    const hit = order.filter((a) => base.includes(a));
    return hit.length > 0 ? hit : base;
  }
  return base;
}

const PERSONALITY_FEATURES_MAP: Record<DesignPersonality, readonly LayoutArchetype[]> = {
  bold_industrial: ["features_timeline", "features_split_visual_lead"],
  elegant_luxury: ["features_bento", "features_editorial_columns"],
  playful_creative: ["features_bento", "features_split_visual_lead"],
  minimal_tech: ["features_editorial_columns", "features_bento"],
  editorial_art: ["features_split_visual_lead", "features_timeline"],
  trust_conversion: ["features_editorial_columns", "features_bento"],
};

const PERSONALITY_TESTIMONIALS_MAP: Record<DesignPersonality, readonly LayoutArchetype[]> = {
  bold_industrial: ["testimonials_quote_wall", "testimonials_grid_showcase"],
  elegant_luxury: ["testimonials_split_spotlight", "testimonials_carousel"],
  playful_creative: ["testimonials_grid_showcase", "testimonials_quote_wall"],
  minimal_tech: ["testimonials_carousel", "testimonials_split_spotlight"],
  editorial_art: ["testimonials_split_spotlight", "testimonials_quote_wall"],
  trust_conversion: ["testimonials_grid_showcase", "testimonials_quote_wall"],
};

const PERSONALITY_PRICING_MAP: Record<DesignPersonality, readonly LayoutArchetype[]> = {
  bold_industrial: ["content_pricing_split_lead", "content_pricing_comparison"],
  elegant_luxury: ["content_pricing_comparison", "content_pricing_split_lead"],
  playful_creative: ["content_pricing_split_lead", "content_pricing_comparison"],
  minimal_tech: ["content_pricing_comparison", "content_pricing_split_lead"],
  editorial_art: ["content_pricing_split_lead", "content_pricing_comparison"],
  trust_conversion: ["content_pricing_comparison", "content_pricing_split_lead"],
};

const ARCHETYPE_TO_COMPONENT_VARIANT = {
  hero_split_product: "hero_split_product_premium",
  hero_centered_editorial: "hero_editorial_centered_premium",
  hero_asymmetric_bento: "hero_bento_asymmetric_premium",
  hero_dark_cinematic: "hero_cinematic_dark_premium",
  hero_nav_split_product: "hero_nav_split_media_premium",
  hero_nav_centered_editorial: "hero_nav_editorial_stack_premium",
  hero_nav_asymmetric_bento: "hero_nav_bento_asymmetric_premium",
  hero_nav_dark_cinematic: "hero_nav_cinematic_dark_premium",
  features_bento: "features_bento_modern",
  features_editorial_columns: "features_editorial_aside_modern",
  features_timeline: "features_timeline_narrative",
  features_split_visual_lead: "features_split_media_lead_modern",
  testimonials_quote_wall: "testimonials_quote_wall_modern",
  testimonials_carousel: "testimonials_carousel_focus_modern",
  testimonials_grid_showcase: "testimonials_grid_showcase_modern",
  testimonials_split_spotlight: "testimonials_spotlight_split_modern",
  cta_stacked_high_contrast: "cta_stacked_contrast_modern",
  cta_floating_card: "cta_floating_card_modern",
  cta_split_media: "cta_split_media_modern",
  content_sidebar_narrative: "content_sidebar_narrative_modern",
  content_faq_accordion: "faq_accordion_clean",
  content_faq_two_column: "faq_two_column_modern",
  content_pricing_comparison: "pricing_three_tier_featured",
  content_pricing_split_lead: "pricing_split_lead_highlight_modern",
} as const satisfies Record<LayoutArchetype, string>;

const FAQ_POOL = ["content_faq_accordion", "content_faq_two_column"] as const satisfies readonly LayoutArchetype[];

const CTA_POOL = [
  "cta_stacked_high_contrast",
  "cta_floating_card",
  "cta_split_media",
] as const satisfies readonly LayoutArchetype[];

const CTA_POOL_LIST: LayoutArchetype[] = [...CTA_POOL];

const FOOTER_POOL = [
  "cta_stacked_high_contrast",
  "cta_floating_card",
  "cta_split_media",
  "content_sidebar_narrative",
] as const satisfies readonly LayoutArchetype[];

export type StudioPromptLayoutMapsOptions = {
  /** Uit design-preset: voegt donkere cinematic hero’s **optioneel** toe (dark/mixed); light blijft editorial-first. */
  themeMode?: ThemeMode;
  /** Override; default = `config.personality` */
  personality?: DesignPersonality;
  /** Zelfde nonce als site-generatie voor reproduceerbare picks. */
  varianceNonce?: string;
  /** Zwemmen/park/watersport e.d.: extra hero-varianten + iets hogere freeform-fractie. */
  leisureLayoutBias?: boolean;
  /**
   * 0–1: deel van de secties (behalve hero/footer) krijgt **geen** `_layout_archetypes` / `_component_variants`-entry —
   * model componeert die band vrijer binnen preset + contract.
   */
  freeformSectionFraction?: number;
  /** Als gezet: `compositionPlan.layoutArchetype` beperkt hero/features/testimonial/pricing-pools vóór sectie-mapping. */
  homepagePlan?: HomepagePlan;
  /** Uit `resolveCompositionPlan`; anders afgeleid uit `site_intent.resolverConfidence`. */
  layoutOptions?: ResolverConfidenceLayoutOptions;
  /** Uit `resolveCompositionPlan`; anders uit `heroExpression` + archetype. */
  pageCompositionBias?: PageCompositionBias;
  /** Optioneel vullen met pool-snapshots vóór/na compositie-bias. */
  poolDebugOut?: CompositionDebugPayload["poolDebug"];
};

export type StudioPromptLayoutMaps = {
  components: Record<string, string>;
  layoutArchetypes: Record<string, LayoutArchetype>;
};

/**
 * Één bron van waarheid: component-variantnamen blijven synchroon met gekozen layout-archetypes.
 * `salt` = zelfde waarde als `varianceNonce` voor reproduceerbare variatie per run.
 *
 * **Geen extra semantiek hier:** conflicten/bias komen uit `resolveCompositionPlan` /
 * `page-composition-bias`; deze functie **consumeert** alleen `layoutOptions` + `pageCompositionBias`.
 */
export function buildStudioPromptLayoutMaps(
  config: SiteConfig,
  salt: string = "",
  options?: StudioPromptLayoutMapsOptions,
): StudioPromptLayoutMaps {
  const personality = options?.personality ?? config.personality;
  const nonce = options?.varianceNonce ?? salt;
  const expGroup = experienceModelLayoutGroup(config.site_intent.experienceModel);
  const macro = options?.homepagePlan?.compositionPlan.layoutArchetype;

  const layoutOpts =
    options?.layoutOptions ??
    applyResolverConfidenceToLayoutOptions(config.site_intent.resolverConfidence);
  const pageBias =
    options?.pageCompositionBias ??
    buildPageCompositionBiasFromHeroExpression({
      heroExpression: getEffectiveHeroExpression(config.site_intent),
      aboveFoldArchetypeId: config.site_intent.aboveFoldArchetypeId,
    });
  const dbg = options?.poolDebugOut;
  const skipMacroNarrow = layoutOpts.biasStrength === "soft";

  let heroPool = biasHeroPoolForExperience(resolveHeroPool(personality, options?.themeMode), expGroup);
  if (dbg) dbg.heroPoolBefore = [...heroPool];

  const tm = options?.themeMode;
  const lightish = tm === "light" || tm === "mixed" || tm === undefined;
  if (options?.leisureLayoutBias && lightish) {
    const bump: LayoutArchetype[] = [
      "hero_nav_centered_editorial",
      "hero_centered_editorial",
      "hero_nav_asymmetric_bento",
    ];
    heroPool = [...new Set([...bump, ...heroPool])];
  }

  let featuresPool = [...resolveFeaturesPoolForExperience(personality, expGroup)];
  let testimonialsPool = [...PERSONALITY_TESTIMONIALS_MAP[personality]];
  let pricingPool = [...PERSONALITY_PRICING_MAP[personality]];

  if (macro && !skipMacroNarrow) {
    heroPool = narrowHeroPoolForCompositionMacro(macro, [...heroPool]);
    featuresPool = narrowFeaturesPoolForCompositionMacro(macro, featuresPool);
    testimonialsPool = narrowTestimonialsPoolForCompositionMacro(macro, testimonialsPool);
    pricingPool = narrowPricingPoolForCompositionMacro(macro, pricingPool);
  }

  if (dbg) dbg.featurePoolBefore = [...featuresPool];
  featuresPool = biasFeaturesPoolByPageComposition(featuresPool, pageBias, layoutOpts);
  if (dbg) dbg.featurePoolAfter = [...featuresPool];

  if (dbg) dbg.proofPoolBefore = [...testimonialsPool];
  testimonialsPool = biasTestimonialsPoolByPageComposition(testimonialsPool, pageBias, layoutOpts);
  if (dbg) dbg.proofPoolAfter = [...testimonialsPool];

  let ctaPool = [...CTA_POOL_LIST];
  if (dbg) dbg.ctaPoolBefore = [...ctaPool];
  ctaPool = biasCtaPoolByPageComposition(ctaPool, pageBias, layoutOpts);
  if (dbg) dbg.ctaPoolAfter = [...ctaPool];

  /** Macro → finaal regime (geen `hero_mixed` in pools) → karakter/expressie. */
  const finalRegime = resolveFinalDesignRegime(config.site_intent);
  heroPool = biasHeroPoolByDesignRegimeWithStrength([...heroPool], finalRegime, layoutOpts);

  heroPool = biasHeroPoolByHeroExpressionWithStrength(
    [...heroPool],
    getEffectiveHeroExpression(config.site_intent),
    layoutOpts,
  );
  if (dbg) dbg.heroPoolAfter = [...heroPool];

  const layoutArchetypes: Record<string, LayoutArchetype> = {};
  const components: Record<string, string> = {};

  for (const rawId of config.sections) {
    const key = rawId.toLowerCase().replace(/[^a-z0-9_-]/g, "");

    let arch: LayoutArchetype;

    if (key === "hero" || key === "top") {
      arch = pick([...heroPool], nonce, `hero:${rawId}`);
    } else if (key === "features" || key === "services") {
      arch = pick(featuresPool, nonce, `features:${rawId}`);
    } else if (key === "trust") {
      arch = pick(testimonialsPool, nonce, `trust:${rawId}`);
    } else if (key === "testimonials") {
      arch = pick(testimonialsPool, nonce, `social:${rawId}`);
    } else if (key === "pricing") {
      arch = pick(pricingPool, nonce, `pricing:${rawId}`);
    } else if (key === "faq") {
      arch = pick(FAQ_POOL, nonce, `faq:${rawId}`);
    } else if (key === "portfolio" || key === "about" || key === "story") {
      arch =
        key === "portfolio" && config.site_intent.experienceModel === "brand_storytelling"
          ? pick(
              ["features_split_visual_lead", "features_editorial_columns", "features_timeline"],
              nonce,
              `portfolio:${rawId}`,
            )
          : "content_sidebar_narrative";
    } else if (key === "cta" || key === "contact") {
      arch = pick(ctaPool, nonce, `cta:${rawId}`);
    } else if (key === "footer") {
      arch = pick(FOOTER_POOL, nonce, `footer:${rawId}`);
    } else {
      arch = pick(featuresPool, nonce, `default:${rawId}`);
    }

    layoutArchetypes[rawId] = arch;
    components[rawId] =
      key === "trust"
        ? "trust_logos_dark"
        : (ARCHETYPE_TO_COMPONENT_VARIANT[arch] ?? `${key || "section"}_modern_default`);
  }

  const baseFreeform = options?.freeformSectionFraction;
  const ff =
    baseFreeform != null && baseFreeform > 0 && options?.leisureLayoutBias
      ? Math.min(1, baseFreeform + 0.08)
      : baseFreeform;
  if (ff != null && ff > 0) {
    const fr = Math.min(1, ff);
    const threshold = Math.floor(10 * fr);
    for (const key of Object.keys(layoutArchetypes)) {
      if (key === "hero" || key === "footer") continue;
      if (fnv1aHash(`${nonce}\nfreeform\n${key}`) % 10 < threshold) {
        delete layoutArchetypes[key];
        delete components[key];
      }
    }
  }

  return { components, layoutArchetypes };
}
