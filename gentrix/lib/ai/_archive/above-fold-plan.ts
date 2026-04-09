/**
 * Above-the-fold subsysteem: archetypen + resolver + prompt/JSON + deterministische hero-pool bias.
 * Invoer: uitsluitend afgeleide {@link UserIntentProfile} en {@link VisualDesignRegime} (zie `derive-user-intent-profile.ts`).
 */

import {
  buildUserIntentProfileFromInterpretation,
  buildVisualDesignRegimeFromInterpretation,
  type UserIntentProfile,
  type VisualDesignRegime,
} from "@/lib/ai/derive-user-intent-profile";
import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import type { AboveFoldArchetypeId, SiteIntent } from "@/lib/ai/site-experience-model";
import { HERO_ARCHETYPES_INTEGRATED, HERO_ARCHETYPES_SPLIT } from "@/lib/ai/above-fold-archetypes";
import type { LayoutArchetype } from "@/types/layoutArchetypes";

export type { AboveFoldArchetypeId } from "@/lib/ai/site-experience-model";

export type AboveFoldMediaMode =
  | "none"
  | "static_image"
  | "hero_video"
  | "cinemagraph"
  | "product_photography"
  | "abstract_visual"
  | "human_centric"
  | "diagram_illustration";

export type AboveFoldNavMode =
  | "transparent_overlay"
  | "floating_glass"
  | "solid_bar"
  | "minimal_bar"
  | "split_navigation";

export type AboveFoldHeadlineMode =
  | "statement"
  | "editorial"
  | "conversion"
  | "campaign"
  | "trust";

export type AboveFoldLayoutMode =
  | "integrated_canvas"
  | "split"
  | "overlay"
  | "center_stage"
  | "media_wall";

export type AboveFoldContentDensity = "low" | "medium" | "high";
export type HeadlineLengthPreference = "short" | "medium" | "variable";
export type InteractivityLevel = "static" | "micro" | "scroll_orchestrated" | "interactive";
export type CtaIntensity = "gentle" | "moderate" | "assertive" | "aggressive";

export type AboveFoldArchetype = {
  id: AboveFoldArchetypeId;
  label: string;
  description: string;
  layoutMode: AboveFoldLayoutMode;
  navMode: AboveFoldNavMode;
  mediaMode: AboveFoldMediaMode;
  headlineMode: AboveFoldHeadlineMode;
  heroIntegrated: boolean;
  prefersTransparentNav: boolean;
  fullBleedPreferred: boolean;
  allowsOverlap: boolean;
  strongVisualLayering: boolean;
  supportsUrgency: boolean;
  supportsDenseScanning: boolean;
  headlineLengthPreference: HeadlineLengthPreference;
  interactivityLevel: InteractivityLevel;
  contentDensity: AboveFoldContentDensity;
  preferredCtaIntensity: CtaIntensity;
  guidance: string[];
  antiPatterns: string[];
};

export type ResolvedAboveFoldPlan = {
  archetype: AboveFoldArchetype;
  rationale: string[];
  heroNotes: string[];
  navNotes: string[];
  logoNotes: string[];
  promptDirectives: string[];
};

export type AboveFoldPromptBlockJSON = {
  system: "above_fold_v2";
  archetype: AboveFoldArchetypeId;
  constraints: {
    layoutMode: AboveFoldLayoutMode;
    navMode: AboveFoldNavMode;
    mediaMode: AboveFoldMediaMode;
    headlineMode: AboveFoldHeadlineMode;
    headlineLengthPreference: HeadlineLengthPreference;
    interactivityLevel: InteractivityLevel;
    contentDensity: AboveFoldContentDensity;
    preferredCtaIntensity: CtaIntensity;
  };
  behavior: {
    heroIntegrated: boolean;
    prefersTransparentNav: boolean;
    fullBleedPreferred: boolean;
    allowsOverlap: boolean;
    strongVisualLayering: boolean;
    supportsUrgency: boolean;
    supportsDenseScanning: boolean;
  };
  rationale: string[];
  heroNotes: string[];
  navNotes: string[];
  logoNotes: string[];
  directives: string[];
  antiPatterns: string[];
};

const ABOVE_FOLD_ARCHETYPES: Record<AboveFoldArchetypeId, AboveFoldArchetype> = {
  integrated_campaign_media: {
    id: "integrated_campaign_media",
    label: "Integrated campaign media",
    description:
      "High-energy above-the-fold canvas where navigation, hero, media and CTA feel like one commercial composition.",
    layoutMode: "integrated_canvas",
    navMode: "transparent_overlay",
    mediaMode: "hero_video",
    headlineMode: "campaign",
    heroIntegrated: true,
    prefersTransparentNav: true,
    fullBleedPreferred: true,
    allowsOverlap: true,
    strongVisualLayering: true,
    supportsUrgency: true,
    supportsDenseScanning: false,
    headlineLengthPreference: "short",
    interactivityLevel: "interactive",
    contentDensity: "medium",
    preferredCtaIntensity: "aggressive",
    guidance: [
      "Treat navbar and hero as one system.",
      "Use full-bleed media with strong hierarchy.",
      "Use short, bold headlines and visible CTA pressure.",
      "Allow overlap, promo elements, labels or deal cues if appropriate.",
    ],
    antiPatterns: [
      "Do not separate nav and hero into stacked rectangles.",
      "Do not use small-card-first composition.",
      "Do not make the first screen polite or brochure-like.",
    ],
  },
  editorial_full_bleed: {
    id: "editorial_full_bleed",
    label: "Editorial full bleed",
    description:
      "Refined full-bleed composition with clean typography, restrained navigation and strong visual calm.",
    layoutMode: "overlay",
    navMode: "minimal_bar",
    mediaMode: "static_image",
    headlineMode: "editorial",
    heroIntegrated: true,
    prefersTransparentNav: true,
    fullBleedPreferred: true,
    allowsOverlap: false,
    strongVisualLayering: false,
    supportsUrgency: false,
    supportsDenseScanning: false,
    headlineLengthPreference: "variable",
    interactivityLevel: "micro",
    contentDensity: "low",
    preferredCtaIntensity: "gentle",
    guidance: [
      "Use one dominant image or media field.",
      "Keep copy restrained, elegant and typographically strong.",
      "Navigation should feel quiet and integrated.",
    ],
    antiPatterns: [
      "Do not introduce retail urgency.",
      "Do not clutter the first screen with too many actions.",
      "Do not turn the layout into a dashboard.",
    ],
  },
  product_split_conversion: {
    id: "product_split_conversion",
    label: "Product split conversion",
    description:
      "Clear commercial split layout with visible product focus, headline, value proposition and CTA.",
    layoutMode: "split",
    navMode: "solid_bar",
    mediaMode: "product_photography",
    headlineMode: "conversion",
    heroIntegrated: false,
    prefersTransparentNav: false,
    fullBleedPreferred: false,
    allowsOverlap: false,
    strongVisualLayering: false,
    supportsUrgency: true,
    supportsDenseScanning: true,
    headlineLengthPreference: "medium",
    interactivityLevel: "micro",
    contentDensity: "medium",
    preferredCtaIntensity: "assertive",
    guidance: [
      "Keep the product or category immediately legible.",
      "Prioritize clarity, conversion and scan-ability.",
      "Make the CTA and value proposition visible without hunting.",
    ],
    antiPatterns: [
      "Do not over-art-direct at the cost of clarity.",
      "Do not bury the action below the fold.",
    ],
  },
  trust_split_clarity: {
    id: "trust_split_clarity",
    label: "Trust split clarity",
    description:
      "Balanced above-the-fold for credibility-heavy sites where trust, clarity and professionalism matter most.",
    layoutMode: "split",
    navMode: "minimal_bar",
    mediaMode: "static_image",
    headlineMode: "trust",
    heroIntegrated: false,
    prefersTransparentNav: false,
    fullBleedPreferred: false,
    allowsOverlap: false,
    strongVisualLayering: false,
    supportsUrgency: false,
    supportsDenseScanning: false,
    headlineLengthPreference: "medium",
    interactivityLevel: "static",
    contentDensity: "low",
    preferredCtaIntensity: "moderate",
    guidance: [
      "Present a strong headline with calm authority.",
      "Use media to support trust, not dominate it.",
      "Keep navigation crisp and conventional enough to feel credible.",
    ],
    antiPatterns: [
      "Do not use aggressive campaign language.",
      "Do not push noisy visual effects.",
      "Do not create retail-style urgency.",
    ],
  },
  immersive_overlay_statement: {
    id: "immersive_overlay_statement",
    label: "Immersive overlay statement",
    description:
      "Large immersive hero with statement-led copy over strong media, suited for brands, campaigns and visual services.",
    layoutMode: "overlay",
    navMode: "transparent_overlay",
    mediaMode: "hero_video",
    headlineMode: "statement",
    heroIntegrated: true,
    prefersTransparentNav: true,
    fullBleedPreferred: true,
    allowsOverlap: true,
    strongVisualLayering: true,
    supportsUrgency: false,
    supportsDenseScanning: false,
    headlineLengthPreference: "short",
    interactivityLevel: "scroll_orchestrated",
    contentDensity: "low",
    preferredCtaIntensity: "assertive",
    guidance: [
      "Use a dominant visual field and a strong concise statement.",
      "Let brand presence and atmosphere lead.",
      "Allow tasteful layering and visual depth.",
    ],
    antiPatterns: [
      "Do not make the hero text-heavy.",
      "Do not add too many supporting modules above the fold.",
    ],
  },
  minimal_statement: {
    id: "minimal_statement",
    label: "Minimal statement",
    description:
      "Extremely clean, restrained first impression with a strong headline, minimal chrome and clear CTA.",
    layoutMode: "center_stage",
    navMode: "minimal_bar",
    mediaMode: "none",
    headlineMode: "statement",
    heroIntegrated: false,
    prefersTransparentNav: false,
    fullBleedPreferred: false,
    allowsOverlap: false,
    strongVisualLayering: false,
    supportsUrgency: false,
    supportsDenseScanning: false,
    headlineLengthPreference: "short",
    interactivityLevel: "static",
    contentDensity: "low",
    preferredCtaIntensity: "moderate",
    guidance: [
      "Use typography and spacing as the main art direction.",
      "Keep the interface stripped back and deliberate.",
      "Use a very small number of elements.",
    ],
    antiPatterns: [
      "Do not compensate with random cards.",
      "Do not add decorative clutter.",
    ],
  },
  showcase_media_wall: {
    id: "showcase_media_wall",
    label: "Showcase media wall",
    description:
      "Image-led above-the-fold with multiple coordinated media surfaces, suited for portfolios, visual brands and highly aesthetic product experiences.",
    layoutMode: "media_wall",
    navMode: "transparent_overlay",
    mediaMode: "static_image",
    headlineMode: "editorial",
    heroIntegrated: true,
    prefersTransparentNav: true,
    fullBleedPreferred: true,
    allowsOverlap: true,
    strongVisualLayering: true,
    supportsUrgency: false,
    supportsDenseScanning: true,
    headlineLengthPreference: "variable",
    interactivityLevel: "scroll_orchestrated",
    contentDensity: "medium",
    preferredCtaIntensity: "gentle",
    guidance: [
      "Let visuals carry the first impression.",
      "Coordinate multiple media surfaces without turning them into cards.",
      "Use restrained text and careful emphasis.",
    ],
    antiPatterns: [
      "Do not reduce the layout to a generic gallery grid.",
      "Do not let explanation overpower the imagery.",
    ],
  },
  dense_commerce_stage: {
    id: "dense_commerce_stage",
    label: "Dense commerce stage",
    description:
      "High-information first screen that still feels art-directed, suited for broader commerce, category-heavy retail and promotional scanning.",
    layoutMode: "integrated_canvas",
    navMode: "solid_bar",
    mediaMode: "product_photography",
    headlineMode: "campaign",
    heroIntegrated: true,
    prefersTransparentNav: false,
    fullBleedPreferred: false,
    allowsOverlap: true,
    strongVisualLayering: true,
    supportsUrgency: true,
    supportsDenseScanning: true,
    headlineLengthPreference: "short",
    interactivityLevel: "interactive",
    contentDensity: "high",
    preferredCtaIntensity: "aggressive",
    guidance: [
      "Support fast scanning, promo visibility and category access.",
      "Keep hierarchy strong even with denser content.",
      "Use campaign cues without collapsing into chaos.",
    ],
    antiPatterns: [
      "Do not use a plain category-card grid as the first impression.",
      "Do not let density destroy hierarchy.",
    ],
  },
  service_conversational: {
    id: "service_conversational",
    label: "Service conversational",
    description:
      "Trust-first above-the-fold focused on human connection, clarity and starting a conversation rather than direct transaction.",
    layoutMode: "center_stage",
    navMode: "solid_bar",
    mediaMode: "human_centric",
    headlineMode: "trust",
    heroIntegrated: false,
    prefersTransparentNav: false,
    fullBleedPreferred: false,
    allowsOverlap: false,
    strongVisualLayering: false,
    supportsUrgency: false,
    supportsDenseScanning: false,
    headlineLengthPreference: "medium",
    interactivityLevel: "micro",
    contentDensity: "medium",
    preferredCtaIntensity: "moderate",
    guidance: [
      "Humanize the value proposition.",
      "Make the primary action about contact or conversation.",
      "Show trust signals early, such as reviews, guarantees or credentials.",
    ],
    antiPatterns: [
      "Do not use aggressive urgency.",
      "Do not treat services like products.",
      "Do not hide contact behind multiple steps.",
    ],
  },
};

export function getAboveFoldArchetypeAntiPatterns(id: AboveFoldArchetypeId): readonly string[] {
  return ABOVE_FOLD_ARCHETYPES[id].antiPatterns;
}

/** Voorkeur-hero’s per above-fold-archetype (doorsnede met bestaande pool in `biasHeroPoolByAboveFoldArchetype`). */
const HERO_PREFERENCE_BY_ARCHETYPE: Record<AboveFoldArchetypeId, readonly LayoutArchetype[]> = {
  integrated_campaign_media: [
    "hero_nav_dark_cinematic",
    "hero_dark_cinematic",
    "hero_nav_asymmetric_bento",
    "hero_asymmetric_bento",
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
  ],
  editorial_full_bleed: [
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
    "hero_nav_asymmetric_bento",
    "hero_asymmetric_bento",
  ],
  product_split_conversion: [...HERO_ARCHETYPES_SPLIT],
  trust_split_clarity: [
    ...HERO_ARCHETYPES_SPLIT,
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
  ],
  immersive_overlay_statement: [
    "hero_nav_dark_cinematic",
    "hero_dark_cinematic",
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
  ],
  minimal_statement: ["hero_nav_centered_editorial", "hero_centered_editorial"],
  showcase_media_wall: [
    "hero_nav_asymmetric_bento",
    "hero_asymmetric_bento",
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
    "hero_nav_dark_cinematic",
    "hero_dark_cinematic",
  ],
  dense_commerce_stage: [
    "hero_nav_split_product",
    "hero_split_product",
    "hero_nav_asymmetric_bento",
    "hero_asymmetric_bento",
    "hero_nav_dark_cinematic",
    "hero_dark_cinematic",
  ],
  service_conversational: [
    "hero_nav_split_product",
    "hero_split_product",
    "hero_nav_centered_editorial",
    "hero_centered_editorial",
  ],
};

/**
 * Deterministische hero-pool bias: doorsnede met `pool`; lege doorsnede → `pool` ongewijzigd.
 * Toepassen **na** composition-macro narrow en `biasHeroPoolByDesignRegime`.
 */
export function biasHeroPoolByAboveFoldArchetype(
  pool: LayoutArchetype[],
  archetypeId: AboveFoldArchetypeId,
): LayoutArchetype[] {
  const preferred = HERO_PREFERENCE_BY_ARCHETYPE[archetypeId];
  const hit = preferred.filter((a) => pool.includes(a));
  return hit.length > 0 ? hit : pool;
}

/** Korte nav-stijlhint voor studio-prompt (naast `navNotes` in het above-fold-blok). */
export function getAboveFoldNavStyleDirective(archetypeId: AboveFoldArchetypeId): string {
  const nav = ABOVE_FOLD_ARCHETYPES[archetypeId].navMode;
  const map: Record<AboveFoldNavMode, string> = {
    transparent_overlay:
      "Navigation: prefer transparent or low-chrome bar integrated with the hero (overlay), not a heavy strip disconnected from the fold.",
    floating_glass:
      "Navigation: floating / glass pill treatment that reads as part of the hero composition.",
    solid_bar: "Navigation: conventional solid top bar with clear separation — credible and scan-friendly.",
    minimal_bar: "Navigation: minimal, quiet bar — typography-led, no retail chrome.",
    split_navigation:
      "Navigation: split pattern (brand vs links) but still coordinated with hero hierarchy.",
  };
  return map[nav];
}

function isHigh(value: "low" | "medium" | "high"): boolean {
  return value === "high";
}

function isMediumOrHigh(value: "low" | "medium" | "high"): boolean {
  return value === "medium" || value === "high";
}

function resolveLowConfidenceFallback(profile: UserIntentProfile): AboveFoldArchetypeId {
  if (profile.mediaDominance === "high") return "editorial_full_bleed";
  if (profile.commerceWeight === "high") return "product_split_conversion";
  return "trust_split_clarity";
}

function resolveArchetypeId(profile: UserIntentProfile, regime: VisualDesignRegime): AboveFoldArchetypeId {
  const mediaHigh = isHigh(profile.mediaDominance);
  const aggressionHigh = isHigh(profile.visualAggression);
  const commerceHigh = isHigh(profile.commerceWeight);
  const trustHigh = isHigh(profile.trustWeight);
  const editorialHigh = isHigh(profile.editorialSignal);
  const experimentalHigh = isHigh(profile.experimentationSignal);
  const temporalHigh = isHigh(profile.temporalSignal);

  if (profile.confidence < 0.4) {
    return resolveLowConfidenceFallback(profile);
  }

  if (profile.visualMode === "corporate_trust" && profile.siteCategory === "service_business") {
    return "service_conversational";
  }

  if (profile.visualMode === "brand_campaign") {
    return "immersive_overlay_statement";
  }

  if (profile.visualMode === "creative_portfolio") {
    return "showcase_media_wall";
  }

  if (profile.visualMode === "editorial_clean") {
    return "editorial_full_bleed";
  }

  if (
    profile.siteCategory === "service_business" &&
    trustHigh &&
    profile.mediaDominance !== "high" &&
    profile.visualAggression !== "high"
  ) {
    return "service_conversational";
  }

  if (regime.mode === "retail_dynamic" && profile.contentVolume === "high") {
    return "dense_commerce_stage";
  }

  if (regime.mode === "retail_dynamic" || (commerceHigh && mediaHigh && (aggressionHigh || temporalHigh))) {
    return "integrated_campaign_media";
  }

  if (
    regime.mode === "conversion_sharp" ||
    (commerceHigh && !aggressionHigh && profile.aboveFoldPriority === "hero_product_focus")
  ) {
    return "product_split_conversion";
  }

  if (regime.mode === "corporate_trust" || (trustHigh && !mediaHigh && !aggressionHigh)) {
    return "trust_split_clarity";
  }

  if (regime.mode === "editorial_clean" || (editorialHigh && !commerceHigh && !aggressionHigh)) {
    return "editorial_full_bleed";
  }

  if (
    regime.mode === "creative_portfolio" ||
    (mediaHigh && experimentalHigh && profile.siteCategory !== "commerce")
  ) {
    return "showcase_media_wall";
  }

  if (regime.mode === "brand_campaign" || (mediaHigh && isMediumOrHigh(profile.visualAggression))) {
    return "immersive_overlay_statement";
  }

  if (regime.mode === "calm_premium" || regime.mode === "luxury_brand") {
    return "editorial_full_bleed";
  }

  if (regime.mode === "minimal_modern" && !mediaHigh && !commerceHigh) {
    return "minimal_statement";
  }

  return "trust_split_clarity";
}

export function resolveAboveFoldArchetype(
  profile: UserIntentProfile,
  regime: VisualDesignRegime,
): ResolvedAboveFoldPlan {
  const archetypeId = resolveArchetypeId(profile, regime);
  const archetype = ABOVE_FOLD_ARCHETYPES[archetypeId];

  const rationale: string[] = [];
  const heroNotes: string[] = [];
  const navNotes: string[] = [];
  const logoNotes: string[] = [];
  const promptDirectives: string[] = [];

  rationale.push(`visual_mode=${profile.visualMode}`);
  rationale.push(`above_fold_priority=${profile.aboveFoldPriority}`);
  rationale.push(`resolved_archetype=${archetype.id}`);
  rationale.push(`visual_regime_mode=${regime.mode}`);

  if (profile.mediaDominance === "high") rationale.push("high media dominance");
  if (profile.visualAggression === "high") rationale.push("high visual aggression");
  if (profile.trustWeight === "high") rationale.push("high trust expectation");
  if (profile.commerceWeight === "high") rationale.push("high commerce expectation");
  if (profile.contentVolume === "high") rationale.push("high content volume");
  if (profile.temporalSignal === "high") rationale.push("strong urgency or temporal signal");
  if (profile.confidence < 0.5) rationale.push("moderated due to lower confidence");

  heroNotes.push(...archetype.guidance.map((x) => `Hero: ${x}`));

  if (archetype.fullBleedPreferred) {
    heroNotes.push("Hero should preferably feel edge-to-edge or visually expansive.");
  }

  switch (archetype.headlineLengthPreference) {
    case "short":
      heroNotes.push("Prefer a concise dominant headline over a long explanatory heading.");
      break;
    case "medium":
      heroNotes.push("Use a balanced headline length with clarity first.");
      break;
    case "variable":
      heroNotes.push("Headline may be concise or slightly narrative, as long as hierarchy stays strong.");
      break;
  }

  if (archetype.supportsDenseScanning) {
    heroNotes.push(
      "Above-the-fold may include supporting scan cues such as categories, offers or key benefits.",
    );
  }

  navNotes.push(`Use nav mode: ${archetype.navMode}.`);

  if (archetype.heroIntegrated) {
    navNotes.push(
      "Navigation should visually belong to the hero composition, not sit as a disconnected strip.",
    );
  }

  if (archetype.prefersTransparentNav) {
    navNotes.push("Prefer transparent or low-chrome navigation if contrast allows.");
  }

  logoNotes.push(
    "Logo should feel art-directed within the above-the-fold composition, not randomly placed.",
  );

  if (archetype.navMode === "transparent_overlay" || archetype.navMode === "minimal_bar") {
    logoNotes.push("Keep logo clean, sharp and restrained.");
  } else {
    logoNotes.push("Logo may carry slightly more presence, but should not overpower the hero.");
  }

  promptDirectives.push(
    `Use above-the-fold archetype: ${archetype.id}.`,
    `Layout mode: ${archetype.layoutMode}.`,
    `Headline mode: ${archetype.headlineMode}.`,
    `Headline length preference: ${archetype.headlineLengthPreference}.`,
    `CTA intensity: ${archetype.preferredCtaIntensity}.`,
    `Interactivity level: ${archetype.interactivityLevel}.`,
    `Media mode: ${archetype.mediaMode}.`,
  );

  promptDirectives.push(...archetype.guidance);

  for (const anti of archetype.antiPatterns) {
    promptDirectives.push(anti);
  }

  if (regime.urgencyStyle === "aggressive") {
    promptDirectives.push("Use visible commercial urgency cues in the first screen.");
  } else if (regime.urgencyStyle === "visible") {
    promptDirectives.push("Introduce controlled urgency without turning the layout chaotic.");
  }

  if (regime.motionStyle === "high_energy") {
    promptDirectives.push("The first screen should feel high-energy and commercially active.");
  } else if (regime.motionStyle === "dynamic") {
    promptDirectives.push("The first screen should avoid static composition and allow visual rhythm.");
  }

  if (profile.confidence < 0.5) {
    promptDirectives.push(
      "Keep the composition premium but slightly safer due to lower interpretation confidence.",
    );
  }

  return {
    archetype,
    rationale,
    heroNotes,
    navNotes,
    logoNotes,
    promptDirectives,
  };
}

export function buildAboveFoldPromptBlock(profile: UserIntentProfile, regime: VisualDesignRegime): string {
  const resolved = resolveAboveFoldArchetype(profile, regime);
  const navDirective = getAboveFoldNavStyleDirective(resolved.archetype.id);

  const lines: string[] = [];
  lines.push("=== ABOVE THE FOLD SYSTEM (v2) ===");
  lines.push(`- archetype: ${resolved.archetype.id}`);
  lines.push(`- label: ${resolved.archetype.label}`);
  lines.push(`- layout_mode: ${resolved.archetype.layoutMode}`);
  lines.push(`- nav_mode: ${resolved.archetype.navMode}`);
  lines.push(`- media_mode: ${resolved.archetype.mediaMode}`);
  lines.push(`- headline_mode: ${resolved.archetype.headlineMode}`);
  lines.push(`- headline_length_preference: ${resolved.archetype.headlineLengthPreference}`);
  lines.push(`- interactivity_level: ${resolved.archetype.interactivityLevel}`);
  lines.push(`- hero_integrated: ${resolved.archetype.heroIntegrated ? "yes" : "no"}`);
  lines.push(`- full_bleed_preferred: ${resolved.archetype.fullBleedPreferred ? "yes" : "no"}`);
  lines.push(`- allows_overlap: ${resolved.archetype.allowsOverlap ? "yes" : "no"}`);
  lines.push(`- supports_urgency: ${resolved.archetype.supportsUrgency ? "yes" : "no"}`);
  lines.push(`- preferred_cta_intensity: ${resolved.archetype.preferredCtaIntensity}`);
  lines.push("");
  lines.push("**Nav layout hint (deterministic):**");
  lines.push(navDirective);
  lines.push("");
  lines.push("## RATIONALE");
  for (const item of resolved.rationale) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## HERO NOTES");
  for (const item of resolved.heroNotes) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## NAV NOTES");
  for (const item of resolved.navNotes) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## LOGO NOTES");
  for (const item of resolved.logoNotes) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## DIRECTIVES");
  for (const item of resolved.promptDirectives) {
    lines.push(`- ${item}`);
  }
  return lines.join("\n");
}

export function buildAboveFoldPromptBlockJSON(
  profile: UserIntentProfile,
  regime: VisualDesignRegime,
): AboveFoldPromptBlockJSON {
  const resolved = resolveAboveFoldArchetype(profile, regime);
  return {
    system: "above_fold_v2",
    archetype: resolved.archetype.id,
    constraints: {
      layoutMode: resolved.archetype.layoutMode,
      navMode: resolved.archetype.navMode,
      mediaMode: resolved.archetype.mediaMode,
      headlineMode: resolved.archetype.headlineMode,
      headlineLengthPreference: resolved.archetype.headlineLengthPreference,
      interactivityLevel: resolved.archetype.interactivityLevel,
      contentDensity: resolved.archetype.contentDensity,
      preferredCtaIntensity: resolved.archetype.preferredCtaIntensity,
    },
    behavior: {
      heroIntegrated: resolved.archetype.heroIntegrated,
      prefersTransparentNav: resolved.archetype.prefersTransparentNav,
      fullBleedPreferred: resolved.archetype.fullBleedPreferred,
      allowsOverlap: resolved.archetype.allowsOverlap,
      strongVisualLayering: resolved.archetype.strongVisualLayering,
      supportsUrgency: resolved.archetype.supportsUrgency,
      supportsDenseScanning: resolved.archetype.supportsDenseScanning,
    },
    rationale: resolved.rationale,
    heroNotes: resolved.heroNotes,
    navNotes: resolved.navNotes,
    logoNotes: resolved.logoNotes,
    directives: resolved.promptDirectives,
    antiPatterns: resolved.archetype.antiPatterns,
  };
}

/** Eén stap: interpretatie + profile → above-fold prompt (voor callers met pipeline-context). */
export function buildAboveFoldPromptBlockFromInterpretation(
  interpretation: PromptInterpretation,
  profile: HeuristicSignalProfile,
  siteIntent?: SiteIntent,
): string {
  const userProfile = buildUserIntentProfileFromInterpretation(interpretation, profile);
  const regime = buildVisualDesignRegimeFromInterpretation(interpretation, profile, siteIntent);
  return buildAboveFoldPromptBlock(userProfile, regime);
}
