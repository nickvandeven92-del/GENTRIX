import type { BrandIdentity, GeneratedLogoSet, LogoSpec } from "@/types/logo";

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg"';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyCase(text: string, c: LogoSpec["wordmark"]["case"]): string {
  const t = text.trim();
  if (c === "upper") return t.toUpperCase();
  if (c === "lower") return t.toLowerCase();
  return t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function initials(brandName: string, wordmark: string): string {
  const src = brandName.trim() || wordmark;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.replace(/[^a-zA-Z0-9]/g, "");
    const b = parts[1]!.replace(/[^a-zA-Z0-9]/g, "");
    if (a && b) return (a[0]! + b[0]!).toUpperCase();
  }
  const alnum = src.replace(/[^a-zA-Z0-9]/g, "");
  const pair = alnum.slice(0, 2).toUpperCase();
  return pair.length >= 2 ? pair : `${alnum.charAt(0) || "M"}${alnum.charAt(1) || "K"}`.toUpperCase();
}

function fontStack(brand: BrandIdentity, fontStyleHint: string): string {
  const h = fontStyleHint.toLowerCase();
  if (h.includes("serif") || brand.typographyDirection === "serif") {
    return "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif";
  }
  if (brand.typographyDirection === "wide") {
    return "system-ui, ui-sans-serif, 'Helvetica Neue', Arial, sans-serif";
  }
  if (brand.typographyDirection === "condensed") {
    return "ui-sans-serif, system-ui, 'Arial Narrow', Arial, sans-serif";
  }
  return "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
}

function wordmarkFontSize(charCount: number): number {
  if (charCount <= 10) return 22;
  if (charCount <= 18) return 18;
  if (charCount <= 28) return 15;
  return 13;
}

function primaryHint(spec: LogoSpec): string {
  return spec.symbol.geometryHints[0]?.toLowerCase() ?? "";
}

function symbolSvgFixed(
  spec: LogoSpec,
  brand: BrandIdentity,
  fill: string,
  box: { x: number; y: number; s: number },
): string {
  const { x, y, s } = box;
  const hint = primaryHint(spec);
  const letter = initials(brand.brandName, spec.wordmark.text);
  const r = Math.max(4, s * 0.22);
  const ff = fontStack(brand, spec.wordmark.fontStyle);

  if (spec.symbol.type === "none" && spec.style !== "monogram") {
    return "";
  }

  if (spec.symbol.type === "monogram" || spec.style === "monogram") {
    const useRound = hint.includes("round") || hint.includes("soft");
    const sw = Math.max(2, s * 0.08);
    const rect = useRound
      ? `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}" stroke="${escapeXml(fill)}" stroke-width="${sw}" fill="none"/>`
      : `<rect x="${x}" y="${y}" width="${s}" height="${s}" stroke="${escapeXml(fill)}" stroke-width="${sw}" fill="none"/>`;
    return `${rect}<text x="${x + s / 2}" y="${y + s * 0.68}" text-anchor="middle" font-family="${escapeXml(ff)}" font-weight="600" font-size="${s * 0.36}" fill="${escapeXml(fill)}">${escapeXml(letter)}</text>`;
  }

  if (spec.symbol.type === "geometric") {
    if (hint.includes("vertical")) {
      const w = s * 0.28;
      return `<rect x="${x + s * 0.15}" y="${y + s * 0.1}" width="${w}" height="${s * 0.8}" rx="${w * 0.15}" fill="${escapeXml(fill)}"/><rect x="${x + s * 0.55}" y="${y + s * 0.35}" width="${s * 0.3}" height="${s * 0.3}" rx="${s * 0.06}" fill="${escapeXml(fill)}" fill-opacity="0.35"/>`;
    }
    return `<rect x="${x + s * 0.12}" y="${y + s * 0.12}" width="${s * 0.76}" height="${s * 0.76}" rx="${r}" fill="${escapeXml(fill)}"/>`;
  }

  if (hint.includes("split")) {
    return `<path d="M${x} ${y} H${x + s} V${y + s * 0.52} H${x + s * 0.52} V${y + s} H${x} Z" fill="${escapeXml(fill)}"/><rect x="${x + s * 0.52}" y="${y + s * 0.52}" width="${s * 0.48}" height="${s * 0.48}" fill="${escapeXml(fill)}" fill-opacity="0.4"/>`;
  }
  if (hint.includes("dot")) {
    const d = s * 0.18;
    const g = s * 0.22;
    const o = (i: number, j: number) =>
      `<circle cx="${x + g + i * g * 2}" cy="${y + g + j * g * 2}" r="${d / 2}" fill="${escapeXml(fill)}"/>`;
    return `${o(0, 0)}${o(1, 0)}${o(0, 1)}${o(1, 1)}`;
  }
  if (hint.includes("corner")) {
    return `<path d="M${x + r} ${y} H${x + s} V${y + s} H${x} V${y + r} Q${x} ${y} ${x + r} ${y} Z" fill="${escapeXml(fill)}"/>`;
  }
  return `<rect x="${x + s * 0.1}" y="${y + s * 0.1}" width="${s * 0.8}" height="${s * 0.8}" rx="${r}" stroke="${escapeXml(fill)}" stroke-width="${Math.max(2, s * 0.07)}" fill="none"/>`;
}

function wordmarkTextEl(
  spec: LogoSpec,
  brand: BrandIdentity,
  x: number,
  yBaseline: number,
  fill: string,
): string {
  const text = applyCase(spec.wordmark.text, spec.wordmark.case);
  const fs = wordmarkFontSize(text.length);
  const ff = fontStack(brand, spec.wordmark.fontStyle);
  return `<text x="${x}" y="${yBaseline}" font-family="${escapeXml(ff)}" font-weight="${spec.wordmark.weight}" font-size="${fs}" letter-spacing="${escapeXml(spec.wordmark.letterSpacing)}" fill="${escapeXml(fill)}">${escapeXml(text)}</text>`;
}

function composeLogo(
  spec: LogoSpec,
  brand: BrandIdentity,
  fill: string,
  secondaryFill?: string,
): { svg: string; viewBox: string } {
  const symFill = secondaryFill ?? fill;
  const wm = applyCase(spec.wordmark.text, spec.wordmark.case);
  const fs = wordmarkFontSize(wm.length);
  const symSize = 40;
  const gap = 14;

  if (spec.style === "wordmark" || (spec.symbol.type === "none" && spec.style !== "monogram")) {
    const w = Math.min(420, 40 + wm.length * (fs * 0.62));
    const vb = `0 0 ${Math.ceil(w)} 52`;
    const inner = wordmarkTextEl(spec, brand, 0, 34, fill);
    return { svg: `${SVG_OPEN} viewBox="${vb}">${inner}</svg>`, viewBox: vb };
  }

  if (spec.layout === "stacked") {
    const inner =
      `${symbolSvgFixed(spec, brand, symFill, { x: 62, y: 4, s: symSize })}` +
      wordmarkTextEl(spec, brand, 0, 96, fill);
    return { svg: `${SVG_OPEN} viewBox="0 0 200 108">${inner}</svg>`, viewBox: "0 0 200 108" };
  }

  const textX = symSize + gap;
  const w = textX + Math.min(340, 24 + wm.length * (fs * 0.62));
  const vb = `0 0 ${Math.ceil(w)} 52`;
  const inner =
    symbolSvgFixed(spec, brand, symFill, { x: 0, y: 6, s: symSize }) +
    wordmarkTextEl(spec, brand, textX, 36, fill);
  return { svg: `${SVG_OPEN} viewBox="${vb}">${inner}</svg>`, viewBox: vb };
}

function iconOnlySvg(spec: LogoSpec, brand: BrandIdentity, fill: string): string {
  const inner = symbolSvgFixed(spec, brand, fill, { x: 8, y: 8, s: 48 });
  if (inner.trim()) {
    return `${SVG_OPEN} viewBox="0 0 64 64">${inner}</svg>`;
  }
  const letter = initials(brand.brandName, spec.wordmark.text).slice(0, 1);
  const ff = fontStack(brand, spec.wordmark.fontStyle);
  return `${SVG_OPEN} viewBox="0 0 64 64"><text x="32" y="44" text-anchor="middle" font-family="${escapeXml(ff)}" font-weight="700" font-size="28" fill="${escapeXml(fill)}">${escapeXml(letter)}</text></svg>`;
}

/**
 * Deterministische SVG-set op basis van gekozen {@link LogoSpec} (geen ruwe model-SVG).
 */
export function renderFinalLogoSet(spec: LogoSpec, brand: BrandIdentity): GeneratedLogoSet {
  const primaryHex = spec.palette.primary;
  const accent = spec.palette.secondary ?? spec.palette.primary;

  const primary = composeLogo(spec, brand, primaryHex, accent).svg;
  const light = composeLogo(spec, brand, spec.palette.monoDark).svg;
  const dark = composeLogo(spec, brand, spec.palette.monoLight).svg;
  const mono = composeLogo(spec, brand, "#000000").svg;
  const icon = iconOnlySvg(spec, brand, primaryHex);
  const favicon = renderFaviconSvg(spec, brand, primaryHex);

  return {
    brandName: brand.brandName,
    selectedConcept: spec.id,
    variants: {
      primary,
      light,
      dark,
      mono,
      icon,
      favicon,
    },
    metadata: {
      logoStyle: spec.style,
      typographyDirection: brand.typographyDirection,
      symbolConcept: spec.symbol.concept,
      usageNotes: [
        "Gebruik `variants.light` (donkere inkt) op lichte headers en witte vlakken.",
        "Gebruik `variants.dark` op donkere footer, hero-overlay of navy achtergronden.",
        "Gebruik `variants.mono` voor drukwerk, juridische footers of éénkleur export.",
        "`variants.icon` en `variants.favicon` zijn geoptimaliseerd voor kleine pixels; geen extra filters toevoegen.",
      ],
    },
  };
}

/** 32×32 favicon; simpele geometrie voor leesbaarheid. */
export function renderFaviconSvg(spec: LogoSpec, brand: BrandIdentity, fill: string): string {
  const hint = primaryHint(spec);
  const letter = initials(brand.brandName, spec.wordmark.text).charAt(0);
  const ff = fontStack(brand, spec.wordmark.fontStyle);

  if (spec.style === "monogram" || spec.symbol.type === "monogram") {
    return `${SVG_OPEN} viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="7" stroke="${escapeXml(fill)}" stroke-width="2" fill="none"/><text x="16" y="21.5" text-anchor="middle" font-family="${escapeXml(ff)}" font-weight="700" font-size="13" fill="${escapeXml(fill)}">${escapeXml(letter)}</text></svg>`;
  }

  if (spec.symbol.type === "geometric" && hint.includes("vertical")) {
    return `${SVG_OPEN} viewBox="0 0 32 32"><rect x="7" y="5" width="6" height="22" rx="1.5" fill="${escapeXml(fill)}"/><rect x="17" y="11" width="9" height="9" rx="2" fill="${escapeXml(fill)}" fill-opacity="0.45"/></svg>`;
  }

  if (hint.includes("dot")) {
    return `${SVG_OPEN} viewBox="0 0 32 32"><circle cx="10" cy="10" r="3.5" fill="${escapeXml(fill)}"/><circle cx="22" cy="10" r="3.5" fill="${escapeXml(fill)}"/><circle cx="10" cy="22" r="3.5" fill="${escapeXml(fill)}"/><circle cx="22" cy="22" r="3.5" fill="${escapeXml(fill)}"/></svg>`;
  }

  return `${SVG_OPEN} viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6" fill="${escapeXml(fill)}"/></svg>`;
}
