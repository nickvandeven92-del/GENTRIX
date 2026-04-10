/**
 * Gestructureerde site-configuratie vóór HTML-generatie.
 * Wordt gebruikt als basis voor design-presets en Claude-prompt.
 *
 * @example
 * ```ts
 * const config: SiteConfig = {
 *   brand_style: "minimal_light",
 *   target_audience: "construction companies",
 *   primary_goal: "lead_generation",
 *   color_palette: { base: "#0B0B0B", accent: "#3B82F6" },
 *   layout_density: "spacious",
 *   visual_style: "high_contrast_depth",
 *   sections: ["hero", "features", "cta", "footer"], // afgeleid uit homepage-plan, max 5
 *   personality: "minimal_tech",
 *   site_intent: SiteIntent // ingesteld door buildSiteConfig (interpretatiepipeline → resolve site intent)
 *   page_length_target?: PageLengthTarget // optioneel; anders afgeleid in resolvePageCompactness
 * };
 * ```
 */

import { applySiteIntentToSiteConfigFields } from "@/lib/ai/apply-site-intent-to-config";
import { buildHomepagePlan, MAX_SITE_CONFIG_SECTIONS } from "@/lib/ai/build-homepage-plan";
import { getDesignPreset, resolveBrandStyleToPresetId } from "@/lib/ai/design-presets";
import { interpretPromptHeuristicOnly } from "@/lib/ai/interpret-prompt-heuristic";
import { runPromptInterpretationPipeline } from "@/lib/ai/interpret-prompt-pipeline";
import { normalizePrompt, preparePromptForInterpretation } from "@/lib/ai/prompt-normalization";
import { designPersonalitySchema, type DesignPersonality } from "@/lib/ai/design-personality";
import { defaultSiteIntent, siteIntentSchema, type SiteIntent } from "@/lib/ai/site-experience-model";
import {
  promptHintsBarberOrGrooming,
  promptHintsDarkSurface,
  resolveBrandStyleFromInterpretation,
  resolvePersonalityFromInterpretation,
  resolvePrimaryGoalString,
  resolveTargetAudienceDescription,
} from "@/lib/ai/resolve-visual-from-interpretation";
import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";
import { validateHomepagePlan } from "@/lib/ai/validate-homepage-plan";
import type { PageLengthTarget } from "@/types/pageCompactness";

/** Snapshot van de canonieke interpretatiepipeline voor afgeleide above-fold / layout-bias (geen tweede waarheid). */
export type PromptInterpretationContext = {
  interpretation: PromptInterpretation;
  profile: HeuristicSignalProfile;
};

export type SiteConfig = {
  /** Design preset ID (moet bestaan in designPresets) */
  brand_style: string;
  /** Doelgroep (beïnvloedt copy en toon) */
  target_audience: string;
  /** Primaire conversiedoel (lead_generation, sales, branding, etc.) */
  primary_goal: string;
  /** Kleurenpalet (base = achtergrond, accent = CTA/highlights) */
  color_palette: {
    base: string;
    accent: string;
  };
  /** Ruimtegebruik */
  layout_density: "compact" | "spacious" | "balanced";
  /** Visuele stijlrichtlijn */
  visual_style: string;
  /** Gewenste secties in volgorde (eerste = hero) */
  sections: string[];
  /** Stijlrichting voor layout-pools + harde personality-regels in de prompt */
  personality: DesignPersonality;
  /** Heuristische site-strategie (experience model, density, trust, …) voor planner + prompts */
  site_intent: SiteIntent;
  /** Optioneel: kiest compactness-preset; anders afgeleid via {@link resolvePageCompactness}. */
  page_length_target?: PageLengthTarget;
  /** Gezet door {@link buildSiteConfig} — nodig voor above-fold v2 + hero-pool bias. */
  prompt_interpretation_context?: PromptInterpretationContext;
};

/**
 * Uit design-image geëxtraheerde kenmerken.
 * Wordt gebruikt om de site-config te finetunen.
 */
export type ExtractedDesignFromImage = {
  layout: string;
  spacing: string;
  colors: string[];
  components: string[];
  style: string;
  /** Optioneel: vision-model mag één van de canonical personality-id’s teruggeven */
  personality?: DesignPersonality;
};

/**
 * Validatie-optie voor buildSiteConfig.
 * Als `strict` true, gooit errors bij ontbrekende velden in userPrompt.
 */
export type BuildSiteConfigOptions = {
  strict?: boolean;
  /** Optioneel: forceer bepaalde brand_style (override auto-detectie) */
  forceBrandStyle?: string;
};

/**
 * Snelle heuristiek zonder async (zelfde signaallaag als de volledige pipeline, geen Claude).
 */
export function detectPersonality(prompt: string): DesignPersonality {
  const { interpretation, profile } = interpretPromptHeuristicOnly(normalizePrompt(prompt));
  return resolvePersonalityFromInterpretation(interpretation, profile);
}

/** Preset-id uit score-gebaseerde heuristiek (sync). */
export function detectBrandStyleFromHeuristic(prompt: string): SiteConfig["brand_style"] {
  const { interpretation, profile } = interpretPromptHeuristicOnly(normalizePrompt(prompt));
  const { normalized } = preparePromptForInterpretation(prompt);
  return resolveBrandStyleFromInterpretation(interpretation, profile, normalized);
}

export function detectPrimaryGoalFromHeuristic(prompt: string): SiteConfig["primary_goal"] {
  const { interpretation } = interpretPromptHeuristicOnly(normalizePrompt(prompt));
  return resolvePrimaryGoalString(interpretation);
}

export function detectTargetAudienceFromHeuristic(prompt: string): string {
  const { interpretation } = interpretPromptHeuristicOnly(normalizePrompt(prompt));
  const { normalized } = preparePromptForInterpretation(prompt);
  return resolveTargetAudienceDescription(interpretation, normalized);
}

/** Palet uit het gekozen design-preset (legacy id’s worden eerst geresolved). */
function getDefaultColorPaletteForBrand(brandStyle: string): SiteConfig["color_palette"] {
  const preset = getDesignPreset(brandStyle);
  return {
    base: preset.colors.background,
    accent: preset.colors.accent,
  };
}

/**
 * Gewichten voor kleur-matching (soft override ipv harde overschrijving).
 * Hoe hoger de weight, hoe meer invloed op de uiteindelijke accentkleur.
 */
const ACCENT_WEIGHTS: Record<string, { color: string; weight: number }[]> = {
  blue: [
    { color: "#3B82F6", weight: 1.0 },
    { color: "#2563EB", weight: 0.8 },
    { color: "#1D4ED8", weight: 0.6 },
  ],
  teal: [
    { color: "#0D9488", weight: 1.0 },
    { color: "#0F766E", weight: 0.8 },
    { color: "#14B8A6", weight: 0.6 },
  ],
  purple: [
    { color: "#7C3AED", weight: 1.0 },
    { color: "#8B5CF6", weight: 0.8 },
    { color: "#A855F7", weight: 0.6 },
  ],
  violet: [
    { color: "#7C3AED", weight: 1.0 },
    { color: "#6D28D9", weight: 0.8 },
    { color: "#5B21B6", weight: 0.6 },
  ],
  green: [
    { color: "#059669", weight: 1.0 },
    { color: "#10B981", weight: 0.8 },
    { color: "#22C55E", weight: 0.6 },
  ],
  orange: [
    { color: "#EA580C", weight: 1.0 },
    { color: "#F97316", weight: 0.8 },
    { color: "#F59E0B", weight: 0.6 },
  ],
  gold: [
    { color: "#D4AF37", weight: 1.0 },
    { color: "#FCD34D", weight: 0.7 },
    { color: "#FBBF24", weight: 0.5 },
  ],
};

/**
 * Haalt de beste accentkleur op basis van geëxtraheerde kleuren.
 * Gebruikt weighted scoring ipv harde keuze.
 */
function deriveAccentFromExtracted(extractedColors: string[], currentAccent: string): string {
  const colorHints = extractedColors.map((c) => c.toLowerCase());
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [keyword, options] of Object.entries(ACCENT_WEIGHTS)) {
    if (colorHints.some((hint) => hint.includes(keyword))) {
      for (const opt of options) {
        const score = opt.weight * (colorHints.filter((h) => h.includes(keyword)).length + 1);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = opt.color;
        }
      }
    }
  }

  return bestMatch ?? currentAccent;
}

/**
 * Bepaalt layout_density op basis van spacing hint.
 */
function deriveLayoutDensity(
  spacingHint: string,
  currentDensity: SiteConfig["layout_density"],
): SiteConfig["layout_density"] {
  const lower = spacingHint.toLowerCase();

  if (lower.includes("tight") || lower.includes("compact") || lower.includes("dense")) {
    return "compact";
  }
  if (lower.includes("loose") || lower.includes("spacious") || lower.includes("airy")) {
    return "spacious";
  }
  if (lower.includes("balanced") || lower.includes("moderate")) {
    return "balanced";
  }

  return currentDensity;
}

/**
 * Bouwt basis SiteConfig op basis van userPrompt.
 *
 * @throws {Error} Alleen als `strict: true` en userPrompt leeg/ongeldig is
 */
export async function buildSiteConfig(
  userPrompt: string,
  options: BuildSiteConfigOptions = {},
): Promise<SiteConfig> {
  if (options.strict && !userPrompt?.trim()) {
    throw new Error("buildSiteConfig: userPrompt mag niet leeg zijn in strict mode");
  }

  const prompt = userPrompt?.trim() ?? "";

  const pipe = await runPromptInterpretationPipeline(prompt);
  if (process.env.NODE_ENV === "development" && process.env.DEBUG_INTERPRETATION === "1") {
    console.info(
      `[buildSiteConfig] interpretatie bron=${pipe.source} confidence=${pipe.interpretation.confidence.toFixed(2)} model=${pipe.siteIntent.experienceModel}`,
    );
  }

  const rawStyle =
    options.forceBrandStyle?.trim() ||
    process.env.DEFAULT_BRAND_STYLE?.trim() ||
    pipe.brandStyle;
  const brandStyle = resolveBrandStyleToPresetId(rawStyle);
  const colorPalette = getDefaultColorPaletteForBrand(brandStyle);

  const homepagePlan = buildHomepagePlan(pipe.siteIntent, prompt);
  const planIssues = validateHomepagePlan(homepagePlan);
  if (process.env.NODE_ENV === "development" && planIssues.length > 0) {
    console.warn("[validateHomepagePlan]", planIssues);
  }
  const fromIntent = applySiteIntentToSiteConfigFields(pipe.siteIntent, homepagePlan);

  const { normalized: normBrief } = preparePromptForInterpretation(prompt);
  /** Briefing expliciet licht/ivoor: geen extra “barber+luxe”-heuristiek die impliciet donker suggereert. */
  const briefAskedLightSurface =
    /\b(licht|helder|light\s+mode|veel\s+wit|crème|creme|ivoor|off-?white|airy|heldere\s+achtergrond)\b/i.test(
      normBrief,
    );
  const barberLuxeCohesive =
    promptHintsBarberOrGrooming(normBrief) &&
    !briefAskedLightSurface &&
    (promptHintsDarkSurface(normBrief) || /\b(luxe|premium|goud|gold|high-?end|elegant)\b/.test(normBrief));

  return {
    brand_style: brandStyle,
    target_audience: pipe.targetAudience,
    color_palette: colorPalette,
    personality: pipe.personality,
    ...fromIntent,
    primary_goal: pipe.primaryGoal,
    ...(barberLuxeCohesive ? { page_length_target: "balanced" satisfies PageLengthTarget } : {}),
    prompt_interpretation_context: {
      interpretation: pipe.interpretation,
      profile: pipe.profile,
    },
  };
}

/**
 * Voegt design-extractie samen met bestaande site-config.
 * Voegt hooguit extra sectie-id's toe tot {@link MAX_SITE_CONFIG_SECTIONS} — geen onbeperkt groeiende lijst.
 */
export function mergeExtractedDesignIntoSiteConfig(
  base: SiteConfig,
  extracted: ExtractedDesignFromImage,
): SiteConfig {
  let mergedSections = [...base.sections];
  for (const comp of extracted.components) {
    if (mergedSections.length >= MAX_SITE_CONFIG_SECTIONS) break;
    if (!mergedSections.includes(comp)) mergedSections.push(comp);
  }
  if (mergedSections.length > MAX_SITE_CONFIG_SECTIONS) {
    const foot = mergedSections.includes("footer");
    const body = mergedSections.filter((s) => s !== "footer");
    const trimmed = body.slice(0, MAX_SITE_CONFIG_SECTIONS - (foot ? 1 : 0));
    mergedSections = foot ? [...trimmed, "footer"] : trimmed;
  }

  const newAccent = deriveAccentFromExtracted(extracted.colors, base.color_palette.accent);
  const newLayoutDensity = deriveLayoutDensity(extracted.spacing ?? "", base.layout_density);
  const newVisualStyle = extracted.style?.trim() ? extracted.style : base.visual_style;
  const parsedPersonality = designPersonalitySchema.safeParse(extracted.personality);
  const personality = parsedPersonality.success ? parsedPersonality.data : base.personality;

  return {
    ...base,
    personality,
    layout_density: newLayoutDensity,
    visual_style: newVisualStyle,
    color_palette: {
      ...base.color_palette,
      accent: newAccent,
    },
    sections: mergedSections.length > 0 ? mergedSections : base.sections,
    prompt_interpretation_context: base.prompt_interpretation_context,
  };
}

/**
 * Valideert een SiteConfig object (runtime type checking).
 */
export function validateSiteConfig(config: unknown): config is SiteConfig {
  const c = config as Record<string, unknown>;

  if (!c || typeof c !== "object") {
    console.error("validateSiteConfig: config is geen object");
    return false;
  }

  const requiredFields = [
    "brand_style",
    "target_audience",
    "primary_goal",
    "color_palette",
    "layout_density",
    "visual_style",
    "sections",
    "personality",
    "site_intent",
  ];
  for (const field of requiredFields) {
    if (!(field in c)) {
      console.error(`validateSiteConfig: missing field '${field}'`);
      return false;
    }
  }

  if (typeof c.brand_style !== "string") return false;
  if (typeof c.target_audience !== "string") return false;
  if (typeof c.primary_goal !== "string") return false;
  if (typeof c.visual_style !== "string") return false;
  if (!Array.isArray(c.sections) || !c.sections.every((s) => typeof s === "string")) return false;

  const palette = c.color_palette as Record<string, unknown>;
  if (!palette || typeof palette !== "object") return false;
  if (typeof palette.base !== "string" || typeof palette.accent !== "string") return false;
  if (!/^#[0-9A-Fa-f]{6}$/.test(palette.base) || !/^#[0-9A-Fa-f]{6}$/.test(palette.accent)) {
    console.error("validateSiteConfig: color_palette moet hex kleuren zijn (#RRGGBB)");
    return false;
  }

  const density = c.layout_density;
  if (density !== "compact" && density !== "spacious" && density !== "balanced") {
    console.error(
      `validateSiteConfig: layout_density moet 'compact', 'spacious' of 'balanced' zijn, kreeg '${String(density)}'`,
    );
    return false;
  }

  if (!designPersonalitySchema.safeParse(c.personality).success) {
    console.error("validateSiteConfig: personality moet een geldige DesignPersonality zijn");
    return false;
  }

  if (!siteIntentSchema.safeParse(c.site_intent).success) {
    console.error("validateSiteConfig: site_intent ongeldig");
    return false;
  }

  return true;
}

/**
 * Factory voor tests of snelle defaults.
 */
export function createDefaultSiteConfig(overrides?: Partial<SiteConfig>): SiteConfig {
  return {
    brand_style: "minimal_light",
    target_audience: "general audience",
    primary_goal: "lead_generation",
    color_palette: { base: "#FFFFFF", accent: "#2563EB" },
    layout_density: "spacious",
    visual_style: "high_contrast_depth",
    sections: ["hero", "features", "cta", "footer"],
    personality: "minimal_tech",
    site_intent: defaultSiteIntent(),
    ...overrides,
  };
}
