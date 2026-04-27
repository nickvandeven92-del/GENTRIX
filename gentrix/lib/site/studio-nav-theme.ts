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
  /**
   * Alleen `--studio-nav-*` custom properties (zelfde als in host-styles), voor op `<header>` te zetten
   * wanneer visuele shell op een **kind** zit: siblings (mobiel sheet) erven `var(--studio-nav-sheet-bg)` dan wél.
   */
  chromeScopeStyle: string;
  /** Zelfde vlakkleur als de bar-host (geen blur); vult `studio-nav-chrome-spacer` zodat app-shell-rand (#primary) niet doorschemert. */
  spacerLayerStyle: string;
  /** Donkere shell (licht op tekst). */
  isDarkChrome: boolean;
  pillRadiusClass: string;
  /**
   * Hoeken voor CTA, hamburgerknop en mobiele menurijen — volgt `theme.borderRadius`, default **none**
   * (scherpe knoppen zoals primaire site-CTA’s); los van `pillRadiusClass` (zwevende nav-shell).
   */
  ctaRadiusClass: string;
  barBottomRadiusClass: string;
  /** Tailwind shadow-* op host (bar of pill). */
  hostShadowClass: string;
};

function hostShadowClass(shadow: NavVisualContract["shadow"]): string {
  if (shadow === "soft") return "shadow-sm";
  if (shadow === "medium") return "shadow-md";
  return "";
}

/**
 * Zwevende pill: rand + diepte (inset highlight + zachte “halo” + drop shadow) — visueel in lijn met
 * hero feature-cards (`border-white/10`, `shadow-black/40`).
 */
function pillShellDepthStyle(visual: NavVisualContract, isDarkChrome: boolean): string {
  if (visual.variant !== "pill") return "";
  if (isDarkChrome) {
    return "box-shadow:0 1px 0 rgba(255,255,255,0.12) inset,0 0 0 1px rgba(0,0,0,0.32),0 24px 52px -14px rgba(0,0,0,0.62);";
  }
  if (visual.surface === "transparent") {
    return "box-shadow:0 1px 0 rgba(255,255,255,0.22) inset,0 0 0 1px rgba(255,255,255,0.14),0 22px 48px -14px rgba(0,0,0,0.55);";
  }
  if (visual.surface === "glass") {
    /* Frosted pill: duidelijke “kaart”-rand + zachte lift (nabij hero feature-cards / ring-white/10). */
    return "box-shadow:0 1px 0 rgba(255,255,255,0.55) inset,0 0 0 1px rgba(15,23,42,0.13),0 0 0 1px rgba(255,255,255,0.28),0 12px 36px -10px rgba(15,23,42,0.2),0 28px 60px -16px rgba(0,0,0,0.45);";
  }
  /* light surface pill */
  return "box-shadow:0 1px 0 rgba(255,255,255,0.52) inset,0 0 0 1px rgba(15,23,42,0.11),0 14px 40px -10px rgba(15,23,42,0.18),0 26px 55px -14px rgba(0,0,0,0.48);";
}

function borderBottomCss(
  visual: NavVisualContract,
  primary: string,
  accent: string,
  isDarkChrome: boolean,
): string {
  if (visual.border === "none") return "border-bottom:none";
  if (visual.border === "accent") return `border-bottom:2px solid ${accent}`;
  /* subtle: neutrale hairline. Oude `rgbaFromHex(primary, 0.22)` oogt als een donkere/zwarte
   * streep onder een lichte balk wanneer `primary` diep slate is (typisch merk-basis in theme). */
  const line = isDarkChrome ? "rgba(255,255,255,0.14)" : "rgba(15, 23, 42, 0.07)";
  return `border-bottom:1px solid ${line}`;
}

export type BuildStudioNavChromeToneOptions = {
  /** Transparante bar + lichte type over donkere hero; spacer hoogte 0 (geen aparte balk boven de hero). */
  heroOverlayBar?: boolean;
};

/**
 * Kleuren + shell volgens `theme` en het **visuele contract** (preset + overrides).
 */
export function buildStudioNavChromeTone(
  theme: MasterPromptTheme | null | undefined,
  visual: NavVisualContract,
  opts?: BuildStudioNavChromeToneOptions,
): StudioNavChromeTone {
  const primary = sanitizeHex(theme?.primary, "#0f172a");
  const accent = sanitizeHex(theme?.accent, "#d4a853");

  if (opts?.heroOverlayBar) {
    const fg = "rgba(248,250,252,0.96)";
    const fgMuted = "rgba(248,250,252,0.82)";
    const fgHover = "#ffffff";
    /** Zwevende cluster over donkere hero: dekkend genoeg voor contrast, geen volle-breedte “witte balk”. */
    const barBg = "rgba(15,23,42,0.48)";
    const pillBg = "rgba(15,23,42,0.48)";
    const blur = "backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);";
    const sheetBg = "rgba(15,23,42,0.96)";
    const sheetBorder = "rgba(255,255,255,0.12)";
    const hoverUi = "rgba(255,255,255,0.12)";
    const brToken = theme?.borderRadius ?? "lg";
    const pillRadiusClass = RADIUS_MAP[brToken] ?? RADIUS_MAP.lg;
    const ctaBrToken = theme?.borderRadius ?? "none";
    const ctaRadiusClass = RADIUS_MAP[ctaBrToken] ?? RADIUS_MAP.none;
    const borderBar = "border:1px solid rgba(255,255,255,0.16)";
    const borderPill = `border:1px solid rgba(255,255,255,0.18)`;
    const cssVars = [
      `--studio-nav-fg:${fg}`,
      `--studio-nav-fg-muted:${fgMuted}`,
      `--studio-nav-fg-hover:${fgHover}`,
      `--studio-nav-accent:${accent}`,
      `--studio-nav-hover-bg:${hoverUi}`,
      `--studio-nav-sheet-bg:${sheetBg}`,
      `--studio-nav-sheet-border:${sheetBorder}`,
    ].join(";");
    const pillHeroDepth =
      "box-shadow:0 1px 0 rgba(255,255,255,0.16) inset,0 0 0 1px rgba(255,255,255,0.12),0 22px 48px -14px rgba(0,0,0,0.48);";
    const barHostStyle = `${borderBar};background:${barBg};color:${fg};${blur}${cssVars}`;
    const pillHostStyle = `${borderPill};background:${pillBg};color:${fg};${blur}${cssVars};${pillHeroDepth}`;
    return {
      barHostStyle,
      pillHostStyle,
      chromeScopeStyle: cssVars,
      spacerLayerStyle: "background:transparent",
      isDarkChrome: false,
      pillRadiusClass,
      ctaRadiusClass,
      barBottomRadiusClass: "",
      hostShadowClass: "shadow-lg",
    };
  }

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
    if (visual.variant === "pill") {
      /* Iets transparanter + sterkere blur: hero/achtergrond leest mee; oogt minder als los wit blok. */
      barBg = "rgba(252,252,254,0.52)";
      pillBg = "rgba(252,252,254,0.58)";
      blur = "backdrop-filter:blur(18px) saturate(1.15);-webkit-backdrop-filter:blur(18px) saturate(1.15);";
    } else {
      barBg = "rgba(255,255,255,0.68)";
      pillBg = "rgba(255,255,255,0.72)";
      blur = "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);";
    }
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
      ? visual.variant === "pill"
        ? "rgba(250,251,253,0.93)"
        : "rgba(255,255,255,0.94)"
      : visual.surface === "transparent"
        ? "rgba(255,255,255,0.96)"
        : isDarkChrome
          ? rgbaFromHex(primary, 0.94)
          : "rgba(255,255,255,0.97)";
  const sheetBorder = isDarkChrome ? "rgba(255,255,255,0.12)" : rgbaFromHex(primary, 0.12);
  const hoverUi = isDarkChrome ? "rgba(255,255,255,0.1)" : rgbaFromHex(primary, 0.08);

  const brToken = theme?.borderRadius ?? "lg";
  const pillRadiusClass = RADIUS_MAP[brToken] ?? RADIUS_MAP.lg;
  const ctaBrToken = theme?.borderRadius ?? "none";
  const ctaRadiusClass = RADIUS_MAP[ctaBrToken] ?? RADIUS_MAP.none;
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

  const pillDepth = pillShellDepthStyle(visual, isDarkChrome);
  const barHostStyle = `${borderBar};background:${barBg};color:${fg};${blur}${cssVars}`;
  const pillHostStyle = `${borderPill};background:${pillBg};color:${fg};${blur}${cssVars};${pillDepth}`;

    /*
   * Spacer: transparant. De nav-header is `fixed` en zweeft boven de pagina;
   * de spacer reserveert alleen verticale ruimte zodat content er niet ónder schuift.
   * Een vaste kleur zou een zichtbare gekleurde balk tonen die niet bij de hero past.
   */
  const spacerLayerStyle = "background:transparent";

  return {
    barHostStyle,
    pillHostStyle,
    chromeScopeStyle: cssVars,
    spacerLayerStyle,
    isDarkChrome,
    pillRadiusClass,
    ctaRadiusClass,
    barBottomRadiusClass,
    hostShadowClass: hostShadowClass(visual.shadow),
  };
}
