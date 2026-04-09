import type { BrandIdentity, LogoCandidateScore, LogoSpec } from "@/types/logo";

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDistance(a: string, b: string): number {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A || !B) return 200;
  const dr = A.r - B.r;
  const dg = A.g - B.g;
  const db = A.b - B.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function clamp10(n: number): number {
  return Math.max(0, Math.min(10, Math.round(n)));
}

/**
 * Deterministische scoring: reproduceerbaar, geen extra model-call.
 */
export function scoreLogoCandidates(
  candidates: LogoSpec[],
  brand: BrandIdentity,
  themePrimary: string,
  themeAccent: string,
): LogoCandidateScore[] {
  const layouts = new Set(candidates.map((c) => c.layout));
  const hasVariety = layouts.size >= 2;

  return candidates.map((c) => {
    const wm = c.wordmark;
    const len = wm.text.length;

    let distinctiveness = 5;
    if (c.symbol.type !== "none") distinctiveness += 2;
    if (hasVariety) distinctiveness += 1;
    if (c.layout === "stacked") distinctiveness += 1;
    if (c.symbol.geometryHints.length > 4) distinctiveness -= 2;

    let premiumFeel = 5;
    if (wm.letterSpacing !== "0" && wm.letterSpacing !== "0em") premiumFeel += 1;
    if (wm.weight >= 500 && wm.weight <= 700) premiumFeel += 1;
    if (len > 36) premiumFeel -= 2;
    if (len <= 22) premiumFeel += 1;
    if (brand.tone === "luxury" && c.style === "wordmark") premiumFeel += 1;

    let scalability = 6;
    if (c.symbol.type === "geometric" || c.symbol.type === "monogram") scalability += 2;
    if (c.symbol.type === "abstract" && c.symbol.geometryHints.length <= 3) scalability += 1;
    if (c.symbol.geometryHints.length > 5) scalability -= 2;
    if (c.symbol.type === "none" && c.style !== "wordmark") scalability -= 1;

    const dPrimary = colorDistance(c.palette.primary, themePrimary);
    const dAccent = colorDistance(c.palette.primary, themeAccent);
    const bestFit = Math.min(dPrimary, dAccent);
    let themeFit = 5;
    if (bestFit < 40) themeFit += 4;
    else if (bestFit < 90) themeFit += 2;
    else if (bestFit > 160) themeFit -= 2;

    let faviconStrength = 4;
    if (c.style === "monogram") faviconStrength += 4;
    else if (c.symbol.type === "geometric") faviconStrength += 3;
    else if (c.symbol.type === "abstract") faviconStrength += 2;
    if (c.symbol.type === "none" && c.style === "wordmark") faviconStrength -= 1;

    const distinctivenessN = clamp10(distinctiveness);
    const premiumFeelN = clamp10(premiumFeel);
    const scalabilityN = clamp10(scalability);
    const themeFitN = clamp10(themeFit);
    const faviconStrengthN = clamp10(faviconStrength);
    const total =
      distinctivenessN + premiumFeelN + scalabilityN + themeFitN + faviconStrengthN;

    return {
      conceptId: c.id,
      distinctiveness: distinctivenessN,
      premiumFeel: premiumFeelN,
      scalability: scalabilityN,
      themeFit: themeFitN,
      faviconStrength: faviconStrengthN,
      total,
    };
  });
}

export function pickBestCandidateId(scores: LogoCandidateScore[]): string {
  let best = scores[0];
  if (!best) return "";
  for (const s of scores) {
    if (s.total > best.total) best = s;
  }
  return best.conceptId;
}
