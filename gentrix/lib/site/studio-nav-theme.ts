import type { MasterPromptTheme } from "@/lib/ai/tailwind-sections-schema";

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

/** Perceptuele helderheid 0–255 (BT.601), voor licht/donker keuze nav-chrome. */
function luminance01(hex: string): number {
  const { r, g, b } = parseRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function rgbaFromHex(hex: string, alpha: number): string {
  const { r, g, b } = parseRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

const RADIUS_MAP: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

const BAR_BOTTOM_RADIUS_MAP: Record<string, string> = {
  none: "",
  sm: "rounded-b-sm",
  md: "rounded-b-md",
  lg: "rounded-b-lg",
  xl: "rounded-b-xl",
  "2xl": "rounded-b-2xl",
  full: "rounded-b-3xl",
};

export type StudioNavChromeTone = {
  /** Volledige `style=""` voor bar-variant host. */
  barHostStyle: string;
  /** Volledige `style=""` voor pill-variant host. */
  pillHostStyle: string;
  /** `true` = lichte tekst op primary-tint chrome. */
  isDarkChrome: boolean;
  /** Afgeronde hoeken pill i.h.a. `theme.borderRadius`. */
  pillRadiusClass: string;
  /** Onderhoeken bar (subtiel); leeg string = geen extra rounding. */
  barBottomRadiusClass: string;
};

/**
 * Kleuren afgeleid van `config.theme` zodat studio-nav bij de rest van de site past.
 */
export function buildStudioNavChromeTone(theme: MasterPromptTheme | null | undefined): StudioNavChromeTone {
  const primary = sanitizeHex(theme?.primary, "#0f172a");
  const accent = sanitizeHex(theme?.accent, "#d4a853");
  const lum = luminance01(primary);
  const isDarkChrome = lum < 145;

  const fg = isDarkChrome ? "rgba(248,250,252,0.96)" : "rgba(15,23,42,0.94)";
  const fgMuted = isDarkChrome ? "rgba(248,250,252,0.82)" : "rgba(15,23,42,0.78)";
  const fgHover = isDarkChrome ? "#ffffff" : "#0f172a";

  /** Iets hogere dekking i.p.v. `backdrop-blur` op de host: blur + scrollende content gaf een “tweede balk”-naad. */
  const barBg = isDarkChrome ? rgbaFromHex(primary, 0.9) : "rgba(255,255,255,0.92)";
  const pillBg = isDarkChrome ? rgbaFromHex(primary, 0.88) : "rgba(255,255,255,0.92)";
  const barBorder = isDarkChrome ? "rgba(255,255,255,0.14)" : rgbaFromHex(primary, 0.22);
  const pillBorder = isDarkChrome ? "rgba(255,255,255,0.18)" : rgbaFromHex(primary, 0.28);
  const sheetBg = isDarkChrome ? rgbaFromHex(primary, 0.94) : "rgba(255,255,255,0.97)";
  const sheetBorder = isDarkChrome ? "rgba(255,255,255,0.12)" : rgbaFromHex(primary, 0.12);
  const hoverUi = isDarkChrome ? "rgba(255,255,255,0.1)" : rgbaFromHex(primary, 0.08);

  const brToken = theme?.borderRadius ?? "lg";
  const pillRadiusClass = RADIUS_MAP[brToken] ?? RADIUS_MAP.lg;
  const barBottomRadiusClass = BAR_BOTTOM_RADIUS_MAP[brToken] ?? BAR_BOTTOM_RADIUS_MAP.lg;

  const cssVars = [
    `--studio-nav-fg:${fg}`,
    `--studio-nav-fg-muted:${fgMuted}`,
    `--studio-nav-fg-hover:${fgHover}`,
    `--studio-nav-accent:${accent}`,
    `--studio-nav-hover-bg:${hoverUi}`,
    `--studio-nav-sheet-bg:${sheetBg}`,
    `--studio-nav-sheet-border:${sheetBorder}`,
  ].join(";");

  const barHostStyle = `border-bottom:1px solid ${barBorder};background:${barBg};color:${fg};${cssVars}`;
  const pillHostStyle = `border:1px solid ${pillBorder};background:${pillBg};color:${fg};box-shadow:0 10px 40px -12px ${rgbaFromHex(primary, 0.35)};${cssVars}`;

  return { barHostStyle, pillHostStyle, isDarkChrome, pillRadiusClass, barBottomRadiusClass };
}
