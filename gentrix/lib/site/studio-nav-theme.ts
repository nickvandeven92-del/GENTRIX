import type { MasterPromptTheme } from "@/lib/ai/tailwind-sections-schema";
import type { NavVisualContract } from "@/lib/site/studio-nav-visual-presets";

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

export type StudioNavChromeTone = {
  barHostStyle: string;
  pillHostStyle: string;
  /** Donkere shell (licht op tekst). */
  isDarkChrome: boolean;
  pillRadiusClass: string;
  barBottomRadiusClass: string;
  /** Tailwind shadow-* op host (bar of pill). */
  hostShadowClass: string;
};

function hostShadowClass(shadow: NavVisualContract["shadow"]): string {
  if (shadow === "soft") return "shadow-sm";
  if (shadow === "medium") return "shadow-md";
  return "";
}

function borderBottomCss(
  visual: NavVisualContract,
  primary: string,
  accent: string,
  isDarkChrome: boolean,
): string {
  if (visual.border === "none") return "border-bottom:none";
  if (visual.border === "accent") return `border-bottom:2px solid ${accent}`;
  /* subtle */
  const line = isDarkChrome ? "rgba(255,255,255,0.14)" : rgbaFromHex(primary, 0.22);
  return `border-bottom:1px solid ${line}`;
}

/**
 * Kleuren + shell volgens `theme` en het **visuele contract** (preset + overrides).
 */
export function buildStudioNavChromeTone(
  theme: MasterPromptTheme | null | undefined,
  visual: NavVisualContract,
): StudioNavChromeTone {
  const primary = sanitizeHex(theme?.primary, "#0f172a");
  const accent = sanitizeHex(theme?.accent, "#d4a853");
  const isDarkChrome = visual.surface === "dark";

  const fg = isDarkChrome ? "rgba(248,250,252,0.96)" : "rgba(15,23,42,0.94)";
  const fgMuted = isDarkChrome ? "rgba(248,250,252,0.82)" : "rgba(15,23,42,0.78)";
  const fgHover = isDarkChrome ? "#ffffff" : "#0f172a";

  let barBg: string;
  let pillBg: string;
  let blur = "";

  if (visual.surface === "dark") {
    barBg = rgbaFromHex(primary, 0.9);
    pillBg = rgbaFromHex(primary, 0.88);
  } else if (visual.surface === "glass") {
    barBg = "rgba(255,255,255,0.68)";
    pillBg = "rgba(255,255,255,0.72)";
    blur = "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);";
  } else if (visual.surface === "transparent") {
    barBg = "transparent";
    pillBg = "rgba(255,255,255,0.06)";
  } else {
    barBg = "rgba(255,255,255,0.92)";
    pillBg = "rgba(255,255,255,0.92)";
  }

  const pillBorder = isDarkChrome ? "rgba(255,255,255,0.18)" : rgbaFromHex(primary, 0.28);
  const sheetBg =
    visual.surface === "glass"
      ? "rgba(255,255,255,0.94)"
      : visual.surface === "transparent"
        ? "rgba(255,255,255,0.96)"
        : isDarkChrome
          ? rgbaFromHex(primary, 0.94)
          : "rgba(255,255,255,0.97)";
  const sheetBorder = isDarkChrome ? "rgba(255,255,255,0.12)" : rgbaFromHex(primary, 0.12);
  const hoverUi = isDarkChrome ? "rgba(255,255,255,0.1)" : rgbaFromHex(primary, 0.08);

  const brToken = theme?.borderRadius ?? "lg";
  const pillRadiusClass = RADIUS_MAP[brToken] ?? RADIUS_MAP.lg;
  const barBottomRadiusClass = "";
  const borderBar = borderBottomCss(visual, primary, accent, isDarkChrome);
  const borderPill =
    visual.border === "none"
      ? "border:1px solid transparent"
      : visual.border === "accent"
        ? `border:1px solid ${accent}`
        : `border:1px solid ${pillBorder}`;

  const cssVars = [
    `--studio-nav-fg:${fg}`,
    `--studio-nav-fg-muted:${fgMuted}`,
    `--studio-nav-fg-hover:${fgHover}`,
    `--studio-nav-accent:${accent}`,
    `--studio-nav-hover-bg:${hoverUi}`,
    `--studio-nav-sheet-bg:${sheetBg}`,
    `--studio-nav-sheet-border:${sheetBorder}`,
  ].join(";");

  const barHostStyle = `${borderBar};background:${barBg};color:${fg};${blur}${cssVars}`;
  const pillHostStyle = `${borderPill};background:${pillBg};color:${fg};${blur}${cssVars}`;

  return {
    barHostStyle,
    pillHostStyle,
    isDarkChrome,
    pillRadiusClass,
    barBottomRadiusClass,
    hostShadowClass: hostShadowClass(visual.shadow),
  };
}
