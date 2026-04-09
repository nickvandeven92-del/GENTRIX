import type { BrandIdentity } from "@/types/logo";
type PresetId = string;

export type LogoPresetDna = {
  tone: BrandIdentity["tone"];
  typographyDirection: BrandIdentity["typographyDirection"];
  logoStyle: BrandIdentity["logoStyle"];
  symbolDirection: string;
  visualKeywordPool: string[];
  extraAvoid: string[];
  colorMode: BrandIdentity["colorMode"];
};

const BASE_AVOID = [
  "generic rocket icons",
  "globe symbols",
  "lightbulb metaphors",
  "speech bubbles",
  "swooshes and motion trails",
  "clipart-style illustrations",
  "3D or glossy effects",
  "hairline strokes that disappear at small sizes",
] as const;

/** Logo-stijl-ID → DNA voor merkgeneratie (onafhankelijk van oude site design-preset). */
const PRESET_LOGO_DNA: Record<PresetId, LogoPresetDna> = {
  minimal_dark: {
    tone: "luxury",
    typographyDirection: "serif",
    logoStyle: "wordmark",
    symbolDirection:
      "Refined wordmark or compact monogram on warm dark; quiet confidence — optional thin rule or letterspacing, no clipart.",
    visualKeywordPool: ["warm dark", "brass accent", "editorial quiet", "craft", "heritage"],
    extraAvoid: [...BASE_AVOID, "neon tech", "electric blue corporate", "mascot icons"],
    colorMode: "brand-accent",
  },
  minimal_light: {
    tone: "minimal",
    typographyDirection: "wide",
    logoStyle: "combination",
    symbolDirection:
      "Friendly open sans wordmark + **simple abstract symbol** (e.g. 2–4 parallel wave lines, ripple, or soft droplet curve) — flat vector, legible at favicon size; **not** initials trapped in a square as the only idea.",
    visualKeywordPool: ["water rhythm", "soft curve", "open forms", "teal + warm accent", "B2C clarity"],
    extraAvoid: [...BASE_AVOID, "heavy black slabs", "default monogram-in-box as entire logo", "corporate globe"],
    colorMode: "brand-accent",
  },
  glass: {
    tone: "technical",
    typographyDirection: "geometric",
    logoStyle: "combination",
    symbolDirection:
      "Abstract minimal geometry (facets, planes, grids) — flat vector only, no glassmorphism inside the logo itself.",
    visualKeywordPool: ["layered planes", "precision grid", "depth without noise", "frosted restraint"],
    extraAvoid: [...BASE_AVOID, "literal glass lens icons", "lens flares"],
    colorMode: "brand-accent",
  },
  luxury: {
    tone: "luxury",
    typographyDirection: "serif",
    logoStyle: "combination",
    symbolDirection: "Refined serif or high-end sans with a subtle monogram or minimal emblem — jewelry-quiet.",
    visualKeywordPool: ["heritage", "craft", "quiet confidence", "fine line rhythm", "reserved"],
    extraAvoid: [...BASE_AVOID, "crowns and tiaras unless brand demands it", "loud gradients"],
    colorMode: "full-brand",
  },
  corporate: {
    tone: "technical",
    typographyDirection: "neo-grotesk",
    logoStyle: "combination",
    symbolDirection: "Stable grid-based mark: simple geometric anchor + clear wordmark; trustworthy, not playful.",
    visualKeywordPool: ["stability", "structure", "trust", "measured rhythm", "clarity"],
    extraAvoid: [...BASE_AVOID, "startup-mascot energy", "hand-drawn quirks"],
    colorMode: "brand-accent",
  },
  editorial: {
    tone: "editorial",
    typographyDirection: "serif",
    logoStyle: "wordmark",
    symbolDirection: "Typography-first masthead feel; strong serif or editorial sans; symbol optional and minimal.",
    visualKeywordPool: ["column grid", "rhythm", "story", "print heritage", "quiet authority"],
    extraAvoid: [...BASE_AVOID, "magazine cliché megaphones", "over-illustrated marks"],
    colorMode: "monochrome",
  },
  playful: {
    tone: "playful",
    typographyDirection: "wide",
    logoStyle: "combination",
    symbolDirection: "Friendly but still premium: rounded geometry or bold monogram — no cartoon mascots.",
    visualKeywordPool: ["bounce", "color discipline", "rounded geometry", "human warmth", "energy"],
    extraAvoid: [...BASE_AVOID, "comic sans energy", "emoji-like shapes", "stick figures"],
    colorMode: "full-brand",
  },
  tech_saas: {
    tone: "technical",
    typographyDirection: "geometric",
    logoStyle: "combination",
    symbolDirection: "Geometric monogram or modular grid mark paired with clean neo-grotesk wordmark.",
    visualKeywordPool: ["modularity", "API-quiet", "systems thinking", "pixel discipline", "signal"],
    extraAvoid: [...BASE_AVOID, "circuit-board clutter", "matrix rain", "robot faces"],
    colorMode: "brand-accent",
  },
  organic_soft: {
    tone: "minimal",
    typographyDirection: "neo-grotesk",
    logoStyle: "combination",
    symbolDirection: "Soft geometry or leaf-abstract only if extremely simplified — prefer wordmark + gentle arc.",
    visualKeywordPool: ["breath", "soft curve", "wellness calm", "natural tone", "care"],
    extraAvoid: [...BASE_AVOID, "literal leaves and trees", "medical crosses unless required"],
    colorMode: "brand-accent",
  },
  commerce_grid: {
    tone: "bold",
    typographyDirection: "condensed",
    logoStyle: "wordmark",
    symbolDirection: "Retail confidence: strong condensed type or compact monogram; readable at small sizes.",
    visualKeywordPool: ["shelf clarity", "price confidence", "grid", "SKU legibility", "direct"],
    extraAvoid: [...BASE_AVOID, "shopping cart icons", "price-tag clichés"],
    colorMode: "full-brand",
  },
  energetic_light: {
    tone: "playful",
    typographyDirection: "geometric",
    logoStyle: "combination",
    symbolDirection: "Bold simple mark + energetic sans; keep shapes chunky for favicon survival.",
    visualKeywordPool: ["launch", "momentum", "sunrise geometry", "bold slice", "startup clarity"],
    extraAvoid: [...BASE_AVOID, "literal rockets", "flames"],
    colorMode: "brand-accent",
  },
  bold_brutalist: {
    tone: "bold",
    typographyDirection: "wide",
    logoStyle: "combination",
    symbolDirection: "Heavy weight, brutalist rectangles; no ornament; industrial strength.",
    visualKeywordPool: ["raw concrete", "chunky type", "stark blocks", "industrial", "honest"],
    extraAvoid: [...BASE_AVOID, "thin elegant hairlines", "pastel softness"],
    colorMode: "monochrome",
  },
  modern_mono: {
    tone: "minimal",
    typographyDirection: "neo-grotesk",
    logoStyle: "monogram",
    symbolDirection: "Single-letter or two-letter monogram in a disciplined grid; Swiss calm.",
    visualKeywordPool: ["mono", "grid", "Swiss", "single accent", "precision"],
    extraAvoid: [...BASE_AVOID, "rainbow gradients", "novelty shapes"],
    colorMode: "monochrome",
  },
};

export function getPresetLogoDna(presetId: PresetId): LogoPresetDna {
  return PRESET_LOGO_DNA[presetId];
}

export function mergeAvoidLists(base: string[], extra: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...base, ...extra]) {
    const k = s.toLowerCase().trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s.trim());
  }
  return out;
}
