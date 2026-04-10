import type { DesignRegime, HeroExpression, SiteExperienceModel, SiteIntent } from "@/lib/ai/site-experience-model";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

/** Twee duidelijke kolommen: media vs copy (geen editorial stack). */
export const HERO_ARCHETYPES_SPLIT: readonly LayoutArchetype[] = [
  "hero_split_product",
  "hero_nav_split_product",
];

/**
 * Één canvas: type-led / bento / gecentreerde editorial — géén klassieke 50/50 product-split.
 * Cinematic varianten (incl. \`hero_*_dark_cinematic\`) zijn **één** pool; lichte full-bleed/editorial hoort evenzeer bij luxe.
 */
export const HERO_ARCHETYPES_INTEGRATED: readonly LayoutArchetype[] = [
  "hero_centered_editorial",
  "hero_nav_centered_editorial",
  "hero_asymmetric_bento",
  "hero_nav_asymmetric_bento",
  "hero_dark_cinematic",
  "hero_nav_dark_cinematic",
];

const HERO_INTEGRATED_CAMPAIGN_POOL: readonly LayoutArchetype[] = [
  "hero_nav_dark_cinematic",
  "hero_dark_cinematic",
  "hero_nav_asymmetric_bento",
  "hero_asymmetric_bento",
  "hero_nav_centered_editorial",
  "hero_centered_editorial",
];

const HERO_EDITORIAL_CALM_POOL: readonly LayoutArchetype[] = [
  "hero_nav_centered_editorial",
  "hero_centered_editorial",
  "hero_nav_asymmetric_bento",
  "hero_asymmetric_bento",
];

const HERO_SPLIT_TRUST_POOL: readonly LayoutArchetype[] = [
  ...HERO_ARCHETYPES_SPLIT,
  "hero_nav_centered_editorial",
  "hero_centered_editorial",
];

const HERO_IMMERSIVE_POOL: readonly LayoutArchetype[] = [
  "hero_nav_dark_cinematic",
  "hero_dark_cinematic",
  "hero_nav_centered_editorial",
  "hero_centered_editorial",
];

const HERO_SHOWCASE_POOL: readonly LayoutArchetype[] = [
  "hero_nav_asymmetric_bento",
  "hero_asymmetric_bento",
  "hero_nav_centered_editorial",
  "hero_centered_editorial",
  "hero_nav_dark_cinematic",
  "hero_dark_cinematic",
];

const HERO_COMMERCE_DENSE_POOL: readonly LayoutArchetype[] = [
  "hero_nav_split_product",
  "hero_split_product",
  "hero_nav_asymmetric_bento",
  "hero_asymmetric_bento",
  "hero_nav_dark_cinematic",
  "hero_dark_cinematic",
];

const HERO_MINIMAL_POOL: readonly LayoutArchetype[] = ["hero_nav_centered_editorial", "hero_centered_editorial"];

/** Voorkeur-hero’s per `HeroExpression` (doorsnede in `biasHeroPoolByHeroExpression`). */
export const HERO_POOL_PREFERENCE_BY_EXPRESSION: Record<HeroExpression, readonly LayoutArchetype[]> = {
  split_clear: [...HERO_ARCHETYPES_SPLIT],
  integrated_hero: [...HERO_ARCHETYPES_INTEGRATED],
  integrated_campaign: HERO_INTEGRATED_CAMPAIGN_POOL,
  editorial_calm: HERO_EDITORIAL_CALM_POOL,
  immersive_overlay: HERO_IMMERSIVE_POOL,
  showcase_visual: HERO_SHOWCASE_POOL,
  commerce_dense: HERO_COMMERCE_DENSE_POOL,
  service_trust: HERO_SPLIT_TRUST_POOL,
  minimal_typographic: HERO_MINIMAL_POOL,
  balanced_mixed: [],
};

function heroExpressionFallbackFromRegime(regime: DesignRegime): HeroExpression {
  if (regime === "hero_split") return "split_clear";
  if (regime === "hero_integrated") return "integrated_hero";
  return "balanced_mixed";
}

/**
 * Layout/prompt: **geen** permanente `hero_mixed` — altijd een harde split- of integrated-keuze.
 * Onderliggende `designRegime` op intent mag `hero_mixed` blijven (legacy/Claude); consumptie gebruikt dit.
 */
export function resolveFinalDesignRegime(intent: SiteIntent): DesignRegime {
  const regime = getEffectiveDesignRegime(intent);
  if (regime !== "hero_mixed") return regime;

  const model = intent.experienceModel;
  if (
    model === "editorial_content_hub" ||
    model === "brand_storytelling" ||
    model === "premium_product"
  ) {
    return "hero_integrated";
  }
  return "hero_split";
}

/** Effectieve `HeroExpression` voor pools/prompts; fallback gebruikt {@link resolveFinalDesignRegime} (niet `hero_mixed`). */
export function getEffectiveHeroExpression(intent: SiteIntent): HeroExpression {
  return intent.heroExpression ?? heroExpressionFallbackFromRegime(resolveFinalDesignRegime(intent));
}

/**
 * Beperkt de hero-pool naar `heroExpression` op `SiteIntent` (of effectieve fallback).
 * `balanced_mixed` = geen extra filter.
 */
export function biasHeroPoolByHeroExpression(pool: LayoutArchetype[], expression: HeroExpression): LayoutArchetype[] {
  if (expression === "balanced_mixed") return pool;
  const preferred = HERO_POOL_PREFERENCE_BY_EXPRESSION[expression];
  const hit = preferred.filter((a) => pool.includes(a));
  return hit.length > 0 ? hit : pool;
}

/** Regime → welke `data-layout`-families boven de fold passen. */
export function deriveDesignRegimeFromExperienceModel(model: SiteExperienceModel): DesignRegime {
  if (model === "ecommerce_home" || model === "search_first_catalog") {
    return "hero_split";
  }
  if (
    model === "editorial_content_hub" ||
    model === "health_authority_content" ||
    model === "brand_storytelling" ||
    model === "premium_product" ||
    model === "community_media"
  ) {
    return "hero_integrated";
  }
  return "hero_mixed";
}

export function getEffectiveDesignRegime(intent: SiteIntent): DesignRegime {
  return intent.designRegime ?? deriveDesignRegimeFromExperienceModel(intent.experienceModel);
}

/** Zorgt voor `designRegime` na externe bronnen (Claude site-intent). */
export function ensureSiteIntentDesignRegime(intent: SiteIntent): SiteIntent {
  return {
    ...intent,
    designRegime: intent.designRegime ?? deriveDesignRegimeFromExperienceModel(intent.experienceModel),
  };
}

/** Voor layout-maps: groepeer modellen met vergelijkbare UI-druk. */
export function experienceModelLayoutGroup(model: SiteExperienceModel): "commerce" | "editorial" | "default" {
  if (model === "ecommerce_home" || model === "search_first_catalog" || model === "hybrid_content_commerce") {
    return "commerce";
  }
  if (
    model === "editorial_content_hub" ||
    model === "health_authority_content" ||
    model === "brand_storytelling"
  ) {
    return "editorial";
  }
  return "default";
}

/**
 * Beperkt de hero-pool naar families die bij `designRegime` horen.
 * Lege doorsnede → originele pool (geen harde crash).
 */
export function biasHeroPoolByDesignRegime(pool: LayoutArchetype[], regime: DesignRegime): LayoutArchetype[] {
  if (regime === "hero_mixed") return pool;
  const preferred = regime === "hero_split" ? HERO_ARCHETYPES_SPLIT : HERO_ARCHETYPES_INTEGRATED;
  const hit = preferred.filter((a) => pool.includes(a));
  return hit.length > 0 ? hit : pool;
}

/**
 * Hard onderscheid voor Claude: `hero_split` ≠ `hero_integrated` (andere HTML-structuur en slots).
 */
export function buildDesignRegimePromptBlock(siteIntent: SiteIntent): string {
  const regime = resolveFinalDesignRegime(siteIntent);
  if (regime === "hero_split") {
    return `=== ABOVE-FOLD REGIME: hero_split (≠ hero_integrated) ===
- **hero_split:** twee duidelijke zones — **mediakolom** en **copy-kolom** (typ. \`hero_split_product\` / \`hero_nav_split_product\`, slots \`media\` + \`content\`). Gebruik **niet** de editorial éénkoloms-stack (\`eyebrow\` / \`headline\` / \`subheadline\` centraal) alsof het hetzelfde patroon is.
- **Verboden hier:** hero opzetten als puur \`hero_centered_editorial\` tenzij de gekozen \`_layout_archetypes.hero\` expliciet anders is — bij regime **hero_split** moet de split-leeslijn leidend zijn.`;
  }
  return `=== ABOVE-FOLD REGIME: hero_integrated (≠ hero_split) ===
- **hero_integrated:** **één** compositievlak — gecentreerde editorial stack, bento/asymmetrische tegels, of full-bleed cinematic (\`hero_centered_editorial\`, \`hero_nav_centered_editorial\`, \`hero_asymmetric_bento\`, \`hero_nav_asymmetric_bento\`, \`hero_dark_cinematic\`, …). Media zit **in** het canvas, niet als losse “productfoto rechts, tekst links”-SaaS-split.
- **Verboden hier:** de klassieke **50/50 product-split** (\`hero_split_product\`) als default — dat is **hero_split**, een ander regime.`;
}

/**
 * Karakterlaag boven split/integrated: gedrag, spanning en premium-rand voor de eerste schermen.
 */
export function buildHeroCharacterBlock(intent: SiteIntent): string {
  const model = intent.experienceModel;

  if (
    model === "brand_storytelling" ||
    model === "editorial_content_hub" ||
    model === "health_authority_content"
  ) {
    return `=== HERO CHARACTER: editorial_statement ===
- Behandel het eerste scherm als een **ontworpen compositie**, geen los UI-blok.
- **Eén dominante boodschap**, geen featurelijst boven de fold.
- Vermijd kaarten, grids en SaaS-patronen in de above-fold zone.
- Hiërarchie, spanning en **visuele terughoudendheid** — laat type en beeld het werk doen.`;
  }

  if (model === "premium_product") {
    return `=== HERO CHARACTER: premium_editorial ===
- Rust, materiaalgevoel en **één sterke merk- of productlijn** — geen schreeuwende retail.
- Geen prijs- of actiechaos boven de fold tenzij de briefing dat expliciet eist.
- Editorial of cinematic mag; vermijd generieke “drie kolommen met icoon”.`;
  }

  if (model === "ecommerce_home" || model === "search_first_catalog" || model === "hybrid_content_commerce") {
    return `=== HERO CHARACTER: commerce_discovery ===
- Laat **product, categorie of aanbod** onmiddellijk zien.
- Geen abstract merkverhaal zonder visuele ankers.
- Ondersteun **scannen en snelle beslissing** — binnen enkele seconden duidelijk “wat kan ik hier doen/kopen”.
- Houd hiërarchie strak; promo’s mogen, maar niet ten koste van helderheid.`;
  }

  if (model === "service_leadgen") {
    return `=== HERO CHARACTER: service_conversational ===
- Dit is het **eerste gezicht** op het bedrijf: minstens **één hero-waardig visueel** (groot beeld, full-bleed, of split met dominant fotografie/video) — niet alleen drie mini-tegels of kale tekst op wit als hele above-fold.
- Maak de **dienst direct begrijpelijk** (voor wie, welk probleem, welk resultaat).
- Geen webshop- of SaaS-product-framing.
- **Lage drempel naar contact** — vertrouwen en duidelijkheid boven spektakel.
- Combineer autoriteit met menselijke toon, geen agressieve urgency.`;
  }

  if (model === "saas_landing") {
    return `=== HERO CHARACTER: experience_clarity ===
- **Belofte + sfeer** in één adem: wat de bezoeker voelt/ervaart en voor wie — ook bij tickets of lidmaatschap, geen abstracte “software-demo”-held.
- Vermijd lege centered headline zonder context; geef **concrete uitkomst** of differentiatie (bestemming, merk, aanbod).
- Geen identieke drie feature-cards als enige above-fold-inhoud; groot beeld, editorial type of filmische scene mogen leiden.`;
  }

  if (model === "community_media") {
    return `=== HERO CHARACTER: community_momentum ===
- Energie en **lidmaatschap / betrokkenheid** — niet anoniem corporate.
- Eerste scherm: waarom meedoen, niet een handleiding.
- Vermijd kille productgrid; mensen en momenten mogen leiden.`;
  }

  return `=== HERO CHARACTER: minimal_authority ===
- Strakke hiërarchie, **geen** generieke centered-hero zonder inhoudelijke haak.
- Scherp en professioneel, niet leeg — vul witruimte met intentie, niet met decoratie.
- Één duidelijke actie of leeslijn; geen vijf gelijkwaardige knoppen.`;
}
