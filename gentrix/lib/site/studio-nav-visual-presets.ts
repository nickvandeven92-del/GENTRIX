import { z } from "zod";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";

/** Canonieke preset-id's — AI mag alleen deze kiezen (of weglaten → server infer). */
export type NavVisualPresetId =
  | "minimalLight"
  | "darkSolid"
  | "glassLight"
  | "floatingPill"
  | "luxuryGold"
  | "editorialTransparent"
  | "softBrand"
  | "compactBar";

export type NavVisualContract = {
  variant: "bar" | "pill";
  surface: "light" | "dark" | "glass" | "transparent";
  height: "compact" | "normal" | "spacious";
  border: "none" | "subtle" | "accent";
  shadow: "none" | "soft" | "medium";
  activeIndicator: "underline" | "pill" | "none";
  ctaStyle: "solid" | "outline" | "ghost";
};

/** Alleen deze drie velden mogen via JSON overschreven worden (hybride, geclamped). */
export const studioNavVisualAllowedOverridesSchema = z
  .object({
    height: z.enum(["compact", "normal", "spacious"]).optional(),
    ctaStyle: z.enum(["solid", "outline", "ghost"]).optional(),
    activeIndicator: z.enum(["underline", "pill", "none"]).optional(),
  })
  .strict();

export type NavVisualAllowedOverrides = z.infer<typeof studioNavVisualAllowedOverridesSchema>;

/** @deprecated gebruik `NavVisualAllowedOverrides` */
export type StudioNavVisualOverrides = NavVisualAllowedOverrides;

export const studioNavVisualSurfaceSchema = z.enum(["light", "dark", "glass", "transparent"]);
export const studioNavVisualHeightSchema = z.enum(["compact", "normal", "spacious"]);
export const studioNavVisualBorderSchema = z.enum(["none", "subtle", "accent"]);
export const studioNavVisualShadowSchema = z.enum(["none", "soft", "medium"]);
export const studioNavVisualActiveIndicatorSchema = z.enum(["underline", "pill", "none"]);
export const studioNavVisualCtaStyleSchema = z.enum(["solid", "outline", "ghost"]);

export const studioNavVisualContractSchema = z.object({
  variant: z.enum(["bar", "pill"]),
  surface: studioNavVisualSurfaceSchema,
  height: studioNavVisualHeightSchema,
  border: studioNavVisualBorderSchema,
  shadow: studioNavVisualShadowSchema,
  activeIndicator: studioNavVisualActiveIndicatorSchema,
  ctaStyle: studioNavVisualCtaStyleSchema,
});

export const NAV_VISUAL_PRESETS: Record<NavVisualPresetId, NavVisualContract> = {
  minimalLight: {
    variant: "bar",
    surface: "light",
    height: "normal",
    border: "subtle",
    shadow: "none",
    activeIndicator: "underline",
    ctaStyle: "solid",
  },
  darkSolid: {
    variant: "bar",
    surface: "dark",
    height: "normal",
    border: "none",
    shadow: "none",
    activeIndicator: "underline",
    ctaStyle: "solid",
  },
  glassLight: {
    variant: "bar",
    surface: "glass",
    height: "normal",
    border: "none",
    shadow: "soft",
    activeIndicator: "underline",
    ctaStyle: "ghost",
  },
  floatingPill: {
    variant: "pill",
    surface: "light",
    height: "normal",
    border: "none",
    shadow: "medium",
    activeIndicator: "pill",
    ctaStyle: "solid",
  },
  luxuryGold: {
    variant: "bar",
    surface: "dark",
    height: "normal",
    border: "accent",
    shadow: "none",
    activeIndicator: "underline",
    ctaStyle: "outline",
  },
  editorialTransparent: {
    variant: "bar",
    surface: "transparent",
    height: "spacious",
    border: "none",
    shadow: "none",
    activeIndicator: "none",
    ctaStyle: "ghost",
  },
  softBrand: {
    variant: "bar",
    surface: "light",
    height: "normal",
    border: "none",
    shadow: "soft",
    activeIndicator: "underline",
    ctaStyle: "solid",
  },
  compactBar: {
    variant: "bar",
    surface: "light",
    height: "compact",
    border: "subtle",
    shadow: "none",
    activeIndicator: "underline",
    ctaStyle: "ghost",
  },
};

const PRESET_IDS = Object.keys(NAV_VISUAL_PRESETS) as NavVisualPresetId[];

export const STUDIO_NAV_VISUAL_PRESET_IDS = PRESET_IDS as [NavVisualPresetId, ...NavVisualPresetId[]];

export const studioNavVisualPresetIdSchema = z.enum(STUDIO_NAV_VISUAL_PRESET_IDS);

/** @deprecated gebruik `NavVisualContract` */
export type StudioNavVisualContract = NavVisualContract;

/** @deprecated gebruik `NAV_VISUAL_PRESETS` */
export const STUDIO_NAV_VISUAL_PRESETS = NAV_VISUAL_PRESETS;

function sanitizeHex(input: string | undefined, fallback: string): string {
  const t = (input ?? "").trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(t)) return t;
  return fallback;
}

function expand3(hex3: string): string {
  const h = hex3.slice(1);
  return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  let h = sanitizeHex(hex, "#475569");
  if (h.length === 4) h = expand3(h);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return { r, g, b };
}

function luminance01(hex: string): number {
  const { r, g, b } = parseRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

export type NavPresetThemeInput = {
  primary?: string;
  accent?: string;
  vibe?: string;
};

/**
 * Server-inferentie (geen preset in JSON): designcontract + theme → preset-id.
 * Volgorde: luxe → glass → editorial → compact → donker → soft brand → default licht.
 */
export function inferNavVisualPresetId(
  theme?: NavPresetThemeInput | null,
  designContract?: DesignGenerationContract | null,
): NavVisualPresetId {
  const primary = theme?.primary ?? "#0f172a";
  const lum = luminance01(primary);
  const vibe = String(theme?.vibe ?? "").toLowerCase();
  const tone = String(designContract?.toneSummary ?? "");
  const axes = designContract?.referenceVisualAxes;

  const luxe =
    vibe === "luxury" ||
    /\b(luxury|luxe|premium|high-end|boutique|exclusive)\b/i.test(tone) ||
    /\b(luxury|luxe|premium|high-end)\b/i.test(vibe);

  if (luxe) return "luxuryGold";
  if (axes?.cardStyle === "glass_blur") return "glassLight";
  if (axes?.layoutRhythm === "editorial_mosaic" || axes?.typographyDirection === "serif_editorial") {
    return "editorialTransparent";
  }
  if (axes?.sectionDensity === "compact") return "compactBar";
  if (designContract?.paletteMode === "dark" || lum < 125) return "darkSolid";
  if (designContract?.paletteMode === "either" && lum >= 125 && lum < 175) return "softBrand";
  return "minimalLight";
}

function mergeAllowedOverrides(base: NavVisualContract, over: NavVisualAllowedOverrides | undefined): NavVisualContract {
  if (!over) return base;
  const parsed = studioNavVisualAllowedOverridesSchema.safeParse(over);
  if (!parsed.success) return base;
  const o = parsed.data;
  const next: NavVisualContract = { ...base };
  if (o.height !== undefined) next.height = o.height;
  if (o.ctaStyle !== undefined) next.ctaStyle = o.ctaStyle;
  if (o.activeIndicator !== undefined) next.activeIndicator = o.activeIndicator;
  return studioNavVisualContractSchema.parse(next);
}

/** Inputvelden uit `StudioNavChromeConfig` (los van links/brand). */
export type StudioNavVisualResolutionInput = {
  variant: "bar" | "pill";
  surface?: "frosted" | "tinted";
  navVisualPreset?: NavVisualPresetId;
  navVisualOverrides?: NavVisualAllowedOverrides;
};

export type ResolvedStudioNavVisual = {
  contract: NavVisualContract;
  /** Alleen gezet bij expliciete `navVisualPreset` in opgeslagen config. */
  presetId: NavVisualPresetId | null;
};

/**
 * Hybride: expliciete preset + toegestane overrides; anders legacy `surface` of infer uit theme/contract.
 */
export function resolveNavVisualPreset(
  input: StudioNavVisualResolutionInput,
  theme?: NavPresetThemeInput | null,
  designContract?: DesignGenerationContract | null,
): ResolvedStudioNavVisual {
  let base: NavVisualContract;
  let presetId: NavVisualPresetId | null = null;

  if (input.navVisualPreset && NAV_VISUAL_PRESETS[input.navVisualPreset]) {
    base = { ...NAV_VISUAL_PRESETS[input.navVisualPreset] };
    presetId = input.navVisualPreset;
    const ov = studioNavVisualAllowedOverridesSchema.safeParse(input.navVisualOverrides ?? {});
    return { contract: mergeAllowedOverrides(base, ov.success ? ov.data : undefined), presetId };
  }

  if (input.variant === "pill") {
    base = { ...NAV_VISUAL_PRESETS.floatingPill };
  } else if (input.surface === "tinted") {
    base = { ...NAV_VISUAL_PRESETS.darkSolid };
  } else {
    const inferred = inferNavVisualPresetId(theme ?? null, designContract ?? null);
    base = { ...NAV_VISUAL_PRESETS[inferred] };
  }
  base = { ...base, variant: input.variant };

  const ov = studioNavVisualAllowedOverridesSchema.safeParse(input.navVisualOverrides ?? {});
  return { contract: mergeAllowedOverrides(base, ov.success ? ov.data : undefined), presetId: null };
}

/** @deprecated gebruik `resolveNavVisualPreset` */
export const resolveStudioNavVisual = (
  input: StudioNavVisualResolutionInput,
  theme?: NavPresetThemeInput | null,
  designContract?: DesignGenerationContract | null,
): ResolvedStudioNavVisual => resolveNavVisualPreset(input, theme, designContract);
