import type { ResolverConfidenceLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import {
  HERO_ARCHETYPES_INTEGRATED,
  HERO_ARCHETYPES_SPLIT,
  HERO_POOL_PREFERENCE_BY_EXPRESSION,
} from "@/lib/ai/above-fold-archetypes";
import type { DesignRegime, HeroExpression } from "@/lib/ai/site-experience-model";
import type { PageCompositionBias } from "@/lib/ai/page-composition-bias";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

function scoreAgainstTags(
  tags: readonly string[],
  preferred: readonly string[],
  discouraged: readonly string[],
): number {
  let s = 0;
  const lower = tags.map((t) => t.toLowerCase());
  for (const p of preferred) {
    const pl = p.toLowerCase();
    if (lower.some((t) => t === pl || t.includes(pl) || pl.includes(t))) s += 3;
  }
  for (const d of discouraged) {
    const dl = d.toLowerCase();
    if (lower.some((t) => t === dl || t.includes(dl) || dl.includes(t))) s -= 2;
  }
  return s;
}

const FEATURE_TAGS: Partial<Record<LayoutArchetype, readonly string[]>> = {
  features_bento: [
    "product",
    "curated",
    "visual",
    "bento",
    "benefits",
    "catalog_dense",
    "conversion_push",
  ],
  features_editorial_columns: [
    "editorial",
    "luxury_minimal",
    "trust_human",
    "clarity",
    "trust",
    "service",
  ],
  features_timeline: ["editorial", "immersive_media", "immersive", "narrative", "timeline"],
  features_split_visual_lead: [
    "product",
    "visual",
    "comparison",
    "benefits",
    "split",
    "conversion_push",
    "catalog_dense",
  ],
};

const TESTIMONIAL_TAGS: Partial<Record<LayoutArchetype, readonly string[]>> = {
  testimonials_quote_wall: [
    "authority",
    "proof_heavy",
    "testimonials",
    "embedded",
    "logos",
  ],
  testimonials_carousel: ["embedded", "subtle", "brand_proof", "trust_human"],
  testimonials_grid_showcase: [
    "numbers",
    "wins",
    "proof",
    "proof_heavy",
    "outcomes",
    "dense_testimonial_grid",
  ],
  testimonials_split_spotlight: [
    "embedded",
    "subtle",
    "authority",
    "comparison_proof",
    "proof_heavy",
  ],
};

const CTA_TAGS: Partial<Record<LayoutArchetype, readonly string[]>> = {
  cta_stacked_high_contrast: [
    "primary_cta",
    "conversion_cta",
    "conversion_push",
    "aggressive_cta",
    "stacked_cta",
  ],
  cta_floating_card: ["offer_cta", "product_cta", "minimal_cta", "editorial_cta"],
  cta_split_media: [
    "product_cta",
    "editorial_cta",
    "comparison_cta",
    "contact_cta",
    "trust_human",
  ],
};

function tagsForArchetype(
  id: LayoutArchetype,
  map: Partial<Record<LayoutArchetype, readonly string[]>>,
): string[] {
  const explicit = map[id];
  if (explicit?.length) return [...explicit];
  return id.replace(/_/g, " ").split(" ").filter(Boolean);
}

function orderPoolByCompositionScores(
  pool: LayoutArchetype[],
  preferred: readonly string[],
  discouraged: readonly string[],
  tagMap: Partial<Record<LayoutArchetype, readonly string[]>>,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  if (pool.length <= 1) return [...pool];

  const scored = pool.map((id) => ({
    id,
    score: scoreAgainstTags(tagsForArchetype(id, tagMap), preferred, discouraged),
  }));
  scored.sort((a, b) => b.score - a.score);
  const ordered = scored.map((x) => x.id);

  if (layout.biasStrength === "soft") {
    return ordered;
  }

  if (layout.biasStrength === "balanced") {
    const negatives = scored.filter((x) => x.score <= -2).map((x) => x.id);
    if (negatives.length && ordered.length - negatives.length >= 2) {
      return ordered.filter((id) => !negatives.includes(id));
    }
    return ordered;
  }

  if (layout.allowAggressiveNarrowing) {
    const positive = scored.filter((x) => x.score > 0).map((x) => x.id);
    if (positive.length >= 1) return positive;
  }

  return ordered;
}

export function biasHeroPoolByDesignRegimeWithStrength(
  pool: LayoutArchetype[],
  regime: DesignRegime,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  if (regime === "hero_mixed") return pool;
  const preferred = regime === "hero_split" ? HERO_ARCHETYPES_SPLIT : HERO_ARCHETYPES_INTEGRATED;
  const hit = preferred.filter((a) => pool.includes(a));
  const rest = pool.filter((a) => !hit.includes(a));

  if (layout.biasStrength === "soft") {
    return hit.length > 0 ? [...hit, ...rest] : pool;
  }
  return hit.length > 0 ? hit : pool;
}

export function biasHeroPoolByHeroExpressionWithStrength(
  pool: LayoutArchetype[],
  expression: HeroExpression,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  if (expression === "balanced_mixed") return pool;
  const preferred = HERO_POOL_PREFERENCE_BY_EXPRESSION[expression];
  const hit = preferred.filter((a) => pool.includes(a));
  const rest = pool.filter((a) => !hit.includes(a));

  if (layout.biasStrength === "soft") {
    return hit.length > 0 ? [...hit, ...rest] : pool;
  }
  return hit.length > 0 ? hit : pool;
}

export function biasFeaturesPoolByPageComposition(
  pool: LayoutArchetype[],
  bias: PageCompositionBias,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  return orderPoolByCompositionScores(
    pool,
    bias.featuresBias.preferredTags,
    bias.featuresBias.discouragedTags,
    FEATURE_TAGS,
    layout,
  );
}

export function biasTestimonialsPoolByPageComposition(
  pool: LayoutArchetype[],
  bias: PageCompositionBias,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  return orderPoolByCompositionScores(
    pool,
    bias.proofBias.preferredTags,
    bias.proofBias.discouragedTags,
    TESTIMONIAL_TAGS,
    layout,
  );
}

export function biasCtaPoolByPageComposition(
  pool: LayoutArchetype[],
  bias: PageCompositionBias,
  layout: ResolverConfidenceLayoutOptions,
): LayoutArchetype[] {
  return orderPoolByCompositionScores(
    pool,
    bias.ctaBias.preferredTags,
    bias.ctaBias.discouragedTags,
    CTA_TAGS,
    layout,
  );
}
