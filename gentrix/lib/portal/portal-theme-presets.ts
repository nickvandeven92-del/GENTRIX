import {
  isLegacyTailwindPageConfig,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
} from "@/lib/ai/tailwind-sections-schema";

/**
 * Preset-id's die door het portaal worden gebruikt.
 *
 * - `original`: behoudt wat de generator heeft gemaakt (welke kleuren dan ook ??? roze, kobalt,
 *   warme creme, zwart). De editor probeert hier **niets** aan te passen; deze slot is
 *   essentieel om altijd terug te kunnen naar "de gegenereerde look".
 * - `light` / `dark` / `warm`: canonieke alternatieven die de gebruiker erbij kan kiezen.
 *   In de UI tonen we altijd **Origineel + 2 alternatieven**. Welke twee alternatieven we
 *   tonen hangt af van de *familie* waar de generator-output al in valt ??? we slaan die
 *   alternatief over om "Origineel" + "Donker" (die visueel identiek lijken) te voorkomen.
 */
export type PortalThemeFamilyId = "light" | "dark" | "warm";
export type PortalThemePresetId = "original" | PortalThemeFamilyId;

/**
 * Minimale baseline wanneer er geen geldige master-config is (legacy / andere payloads):
 * de flyer toont dan alsnog dezelfde drie portaal-labels + kleurlogica als in het klantportaal.
 */
export const PORTAL_FLYER_THEME_BASELINE: MasterPromptPageConfig = {
  style: " ",
  font: "ui-sans-serif, system-ui, sans-serif",
  theme: {
    primary: "#4f46e5",
    accent: "#818cf8",
    secondary: "#64748b",
    background: "#fafafa",
    textColor: "#0f172a",
    textMuted: "#64748b",
    contrastLevel: "medium",
  },
};

export type PortalThemePreset = {
  id: PortalThemePresetId;
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

/** Wahrgenommen helderheid (0-1) volgens ITU-R BT.601. */
function perceivedLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/**
 * Classificeert een pageConfig in ??n familie: light / dark / warm.
 *
 * Simpele, voorspelbare regels op basis van de **achtergrondkleur**:
 * - Donkere achtergrond (luminance < ~0.30) ? `dark`.
 * - Lichte achtergrond met merkbare warme ondertoon (rood > blauw, moderate verzadiging,
 *   luminance > ~0.55) ? `warm`.
 * - Alle overige lichte/neutrale achtergronden ? `light`.
 *
 * De heuristiek is bewust conservatief: liever een klantsite als `light` bestempelen dan
 * als `warm`, zodat gebruikers altijd een duidelijk "Warm"-alternatief naast hun origineel
 * zien staan.
 */
export function classifyPaletteFamily(config: MasterPromptPageConfig): PortalThemeFamilyId {
  const bgHex = normalizeHex(config.theme.background, "#ffffff");
  const bg = hexToRgb(bgHex);
  const luminance = perceivedLuminance(bgHex);

  if (luminance < 0.3) return "dark";

  const rMinusB = bg.r - bg.b;
  const rMinusG = bg.r - bg.g;
  // Warme ondertoon: rood/oranje-amber bereik, merkbaar maar niet rood-schel.
  const isWarmBg = rMinusB >= 12 && rMinusG >= 2 && luminance >= 0.55 && luminance <= 0.97;
  if (isWarmBg) return "warm";

  return "light";
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
 * Licht: helder, neutrale achtergrond + leesbaar donker primary. Accent van de originele
 * merkkleur behouden zodat het merk herkenbaar blijft.
 */
function buildLightPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const origPrimary = normalizeHex(base.theme.primary, "#1f2937");
  const origAccent = normalizeHex(base.theme.accent, "#c08a4a");
  const background = "#fafafa";
  // Primary gaat sterk naar donker-neutraal zodat knoppen/navbar leesbaar zijn op een lichte achtergrond,
  // maar we mengen nog 30% van het originele primary zodat een unieke brand-tint (bv. kobalt/roze)
  // herkenbaar blijft.
  const primary = mixHex(origPrimary, "#0f172a", 0.55);
  const accent = origAccent;
  const textColor = "#0f172a";
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: mixHex(primary, "#64748b", 0.35),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "medium",
    },
  };
}

/**
 * Donker: altijd een duidelijk zeer donkere achtergrond (??k wanneer het origineel al donker
 * oogt, zodat "Donker" en "Origineel" nooit dezelfde tegel lijken). Primary wordt licht
 * getrokken voor leesbaarheid; accent blijft dicht bij de originele merkkleur.
 */
function buildDarkPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const origPrimary = normalizeHex(base.theme.primary, "#1f2937");
  const origAccent = normalizeHex(base.theme.accent, "#c08a4a");
  const background = "#0b0d12";
  // Primary: flink oplichten ? lichtgrijs met subtiele originele tint (zodat knoppen/nav
  // zichtbaar zijn op de diepe achtergrond). Voor een roze origineel blijft een hint van roze
  // zichtbaar in hovers/gradients.
  const primary = mixHex(origPrimary, "#dbe4ee", 0.55);
  const accent = mixHex(origAccent, "#ffd89b", 0.18);
  const textColor = "#f0f4f8";
  return {
    ...base,
    theme: {
      ...base.theme,
      primary,
      accent,
      secondary: mixHex(primary, "#94a3b8", 0.35),
      background,
      textColor,
      textMuted: withMutedText(textColor, background),
      contrastLevel: "high",
    },
  };
}

/**
 * Warm: crème/amber achtergrond — altijd merkbaar warm, ongeacht het originele palet.
 */
function buildWarmPreset(base: MasterPromptPageConfig): MasterPromptPageConfig {
  const origPrimary = normalizeHex(base.theme.primary, "#2b2f36");
  const origAccent = normalizeHex(base.theme.accent, "#c08a4a");
  const background = mixHex(normalizeHex(base.theme.background, "#fffaf4"), "#f2e0c0", 0.82);
  const primary = mixHex(origPrimary, "#3d2512", 0.38);
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

const FAMILY_BUILDERS: Record<PortalThemeFamilyId, (base: MasterPromptPageConfig) => MasterPromptPageConfig> = {
  light: buildLightPreset,
  dark: buildDarkPreset,
  warm: buildWarmPreset,
};

/**
 * Geeft de **pageConfig** terug voor een specifieke preset-id, onafhankelijk van welke
 * alternatieven `buildPortalThemePresets` in de UI toont. Nuttig aan de server-kant waar we
 * `themeId` valideren en het doel-palet willen afleiden, ook al is dat palet misschien niet
 * zichtbaar als alternatieve tegel.
 */
export function resolvePortalThemePresetConfig(
  baseConfig: TailwindPageConfig,
  themeId: PortalThemePresetId,
): TailwindPageConfig | null {
  if (isLegacyTailwindPageConfig(baseConfig)) return null;
  if (themeId === "original") return baseConfig;
  return FAMILY_BUILDERS[themeId](baseConfig);
}

const FAMILY_META: Record<PortalThemeFamilyId, { label: string; description: string }> = {
  light: {
    label: "Licht",
    description: "Heldere, neutrale variant met een lichte achtergrond.",
  },
  dark: {
    label: "Donker",
    description: "Diepe, premium variant met een donkere achtergrond.",
  },
  warm: {
    label: "Warm",
    description: "Zachte, warme variant met amber-creme ondertoon.",
  },
};

/**
 * Produceert de drie tegels die de klant in het portaal ziet:
 *   1. Origineel ??? exact de kleuren die de generator heeft gemaakt (whatever that is).
 *   2. & 3. Twee alternatieven uit {Licht, Donker, Warm} ??? precies degene die NIET
 *      in dezelfde familie vallen als het origineel. Dit voorkomt dubbel-lijkende tegels
 *      (bv. een donker origineel met een "Donker"-preset ernaast).
 *
 * Zo kan de generator vrij zijn keuze maken (roze bollete, paars, kobalt) en krijgt de
 * klant altijd drie visueel duidelijk verschillende opties.
 */
export function buildPortalThemePresets(pageConfig?: TailwindPageConfig | null): PortalThemePreset[] {
  if (!pageConfig || isLegacyTailwindPageConfig(pageConfig)) return [];

  const originalFamily = classifyPaletteFamily(pageConfig);
  const alternatives = (["light", "dark", "warm"] as const).filter((family) => family !== originalFamily);

  const originalPreset: PortalThemePreset = {
    id: "original",
    label: "Origineel",
    description: "De merkkleuren zoals gegenereerd voor deze website.",
    swatches: themeSwatches(pageConfig),
    pageConfig,
  };

  const alternativePresets: PortalThemePreset[] = alternatives.map((family) => {
    const derived = FAMILY_BUILDERS[family](pageConfig);
    return {
      id: family,
      label: FAMILY_META[family].label,
      description: FAMILY_META[family].description,
      swatches: themeSwatches(derived),
      pageConfig: derived,
    };
  });

  return [originalPreset, ...alternativePresets];
}

/** Rij voor flyer-preview: zelfde ids/labels als `buildPortalThemePresets`, met platte kleuren voor CSS-vars. */
export type FlyerPortalThemePresetRow = {
  id: PortalThemePresetId;
  label: string;
  description: string;
  primary: string;
  accent: string;
  background: string;
  text: string;
};

export function buildFlyerPortalThemePresetRows(
  pageConfig?: TailwindPageConfig | null,
): FlyerPortalThemePresetRow[] {
  const base: TailwindPageConfig =
    pageConfig && !isLegacyTailwindPageConfig(pageConfig) ? pageConfig : PORTAL_FLYER_THEME_BASELINE;
  return buildPortalThemePresets(base).map((preset) => {
    const cfg = preset.pageConfig as MasterPromptPageConfig;
    const t = cfg.theme;
    return {
      id: preset.id,
      label: preset.label,
      description: preset.description,
      primary: normalizeHex(t.primary, "#1f2937"),
      accent: normalizeHex(t.accent, "#c08a4a"),
      background: normalizeHex(t.background, "#ffffff"),
      text: normalizeHex(t.textColor, "#0f172a"),
    };
  });
}
