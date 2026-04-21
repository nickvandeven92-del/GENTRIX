import {
  isLegacyTailwindPageConfig,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
} from "@/lib/ai/tailwind-sections-schema";

export type PortalThemePreset = {
  id: "light" | "dark" | "warm";
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

function themeSwatches(config: MasterPromptPageConfig): [string, string, string] {
  const primary = normalizeHex(config.theme.primary, "#1f2937");
  const accent = normalizeHex(config.theme.accent, "#c08a4a");
  const background = normalizeHex(config.theme.background, "#ffffff");
  return [primary, accent, background];
}

function withMutedText(textColor: string, background: string): string {
  return mixHex(textColor, background, 0.42);
}

function buildLightPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const primary = normalizeHex(base.theme.primary, "#1f2937");
  const accent = normalizeHex(base.theme.accent, "#c08a4a");
  const background = mixHex(normalizeHex(base.theme.background, "#ffffff"), "#fff8f0", 0.55);
  const textColor = mixHex(normalizeHex(base.theme.textColor, primary), "#111827", 0.4);
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: normalizeHex(base.theme.secondary, mixHex(primary, "#7c8aa0", 0.38)),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "medium",
    },
  };
}

function buildDarkPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const primary = mixHex(normalizeHex(base.theme.primary, "#1f2937"), "#dbe4f0", 0.16);
  const accent = mixHex(normalizeHex(base.theme.accent, "#c08a4a"), "#f7efe3", 0.12);
  const background = mixHex(normalizeHex(base.theme.primary, "#0f172a"), "#090b12", 0.72);
  const textColor = "#f8fafc";
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: normalizeHex(base.theme.secondary, mixHex(primary, "#94a3b8", 0.4)),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "high",
    },
  };
}

function buildWarmPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const primary = mixHex(normalizeHex(base.theme.primary, "#2b2f36"), "#4a3524", 0.24);
  const accent = mixHex(normalizeHex(base.theme.accent, "#c08a4a"), "#d7a969", 0.28);
  const background = mixHex(normalizeHex(base.theme.background, "#fffaf4"), "#efe2d2", 0.58);
  const textColor = mixHex(normalizeHex(base.theme.textColor, primary), "#2f241b", 0.5);
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: normalizeHex(base.theme.secondary, mixHex(primary, "#9c8166", 0.42)),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "medium",
    },
  };
}

export function buildPortalThemePresets(pageConfig?: TailwindPageConfig | null): PortalThemePreset[] {
  if (!pageConfig || isLegacyTailwindPageConfig(pageConfig)) return [];

  const light = buildLightPreset(pageConfig);
  const dark = buildDarkPreset(pageConfig);
  const warm = buildWarmPreset(pageConfig);

  return [
    {
      id: "light",
      label: "Licht",
      description: "Heldere basis met dezelfde merkaccenten.",
      swatches: themeSwatches(light),
      pageConfig: light,
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