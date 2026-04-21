import {
  isLegacyTailwindPageConfig,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
} from "@/lib/ai/tailwind-sections-schema";

export type PortalThemePreset = {
  id: "original" | "dark" | "warm";
  label: string;
  description: string;
  swatches: [string, string, string];
  pageConfig: TailwindPageConfig;
};

type Rgb = { r: number; g: number; b: number };

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHex(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (!match) return fallback;
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((char) => char + char)
      .join("")}`.toLowerCase();
  }
  return `#${hex}`.toLowerCase();
}

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(rgb: Rgb): string {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clampByte(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(a: string, b: string, amount: number): string {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  const ratio = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: left.r + (right.r - left.r) * ratio,
    g: left.g + (right.g - left.g) * ratio,
    b: left.b + (right.b - left.b) * ratio,
  });
}

/**
 * Volgorde: [achtergrond, primair, accent] — achtergrond staat vooraan zodat de
 * klant direct het grootste kleurverschil tussen de thema's ziet.
 */
function themeSwatches(config: MasterPromptPageConfig): [string, string, string] {
  const background = normalizeHex(config.theme.background, "#ffffff");
  const primary = normalizeHex(config.theme.primary, "#1f2937");
  const accent = normalizeHex(config.theme.accent, "#c08a4a");
  return [background, primary, accent];
}

function withMutedText(textColor: string, background: string): string {
  return mixHex(textColor, background, 0.42);
}

/**
 * Donker: altijd een diepe, donkere achtergrond — primary wordt sterk verlicht
 * zodat tekst en knoppen leesbaar blijven op de donkere achtergrond.
 */
function buildDarkPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const origPrimary = normalizeHex(base.theme.primary, "#1f2937");
  const origAccent = normalizeHex(base.theme.accent, "#c08a4a");
  // Achtergrond: altijd erg donker — mix van primary (tint behouden) met bijna-zwart
  const background = mixHex(origPrimary, "#080a0f", 0.82);
  // Primary: flink oplichten zodat knoppen/accenten zichtbaar zijn op donkere achtergrond
  const primary = mixHex(origPrimary, "#c8dce8", 0.52);
  // Accent: iets oplichten voor leesbaarheid
  const accent = mixHex(origAccent, "#f5e8cc", 0.25);
  const textColor = "#f0f4f8";
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: mixHex(primary, "#94a3b8", 0.4),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "high",
    },
  };
}

/**
 * Warm: warme crème/amber achtergrond — altijd merkbaar warm, ongeacht de originele kleuren.
 * Primary wordt getint met warm bruin, accent rijker/amberkleuriger.
 */
function buildWarmPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const origPrimary = normalizeHex(base.theme.primary, "#2b2f36");
  const origAccent = normalizeHex(base.theme.accent, "#c08a4a");
  // Achtergrond: altijd warm crème, sterk getrokken naar amber-beige
  const background = mixHex(normalizeHex(base.theme.background, "#fffaf4"), "#f2e0c0", 0.78);
  // Primary: warm bruin tint
  const primary = mixHex(origPrimary, "#3d2512", 0.35);
  // Accent: rijker/amberkleuriger
  const accent = mixHex(origAccent, "#c4831c", 0.35);
  const textColor = mixHex(primary, "#1a0f08", 0.4);
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: mixHex(primary, "#8c6040", 0.42),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "medium",
    },
  };
}

export function buildPortalThemePresets(pageConfig?: TailwindPageConfig | null): PortalThemePreset[] {
  if (!pageConfig || isLegacyTailwindPageConfig(pageConfig)) return [];

  const dark = buildDarkPreset(pageConfig);
  const warm = buildWarmPreset(pageConfig);

  return [
    {
      id: "original",
      label: "Origineel",
      description: "De merkkleuren zoals gegenereerd voor deze website.",
      swatches: themeSwatches(pageConfig),
      pageConfig,
    },
    {
      id: "dark",
      label: "Donker",
      description: "Diepe, premium variant met dezelfde visuele richting.",
      swatches: themeSwatches(dark),
      pageConfig: dark,
    },
    {
      id: "warm",
      label: "Warm",
      description: "Zachte, elegante toon zonder losse kleuruitspattingen.",
      swatches: themeSwatches(warm),
      pageConfig: warm,
    },
  ];
}