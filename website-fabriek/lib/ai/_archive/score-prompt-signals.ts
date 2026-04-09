import type {
  BusinessModelInterpreted,
  PrimaryGoalInterpreted,
  VisualEnergy,
  VisualTone,
} from "@/lib/ai/prompt-interpretation-types";
import type { PromptSignalLocale, WeightedToken } from "@/lib/ai/prompt-signal-groups";
import {
  CONTRAST_PATTERNS,
  filterRegexByLocale,
  filterWeightedByLocale,
  INDUSTRY_HINT_ID_TO_LABEL,
  NEGATION_PATTERNS,
  PHRASE_PATTERNS,
  REGEX_CORPORATE_SPILLOVER,
  REGEX_EDITORIAL_VINTAGE_ROOTS,
  REGEX_LEAD_STRONG,
  REGEX_LUXURY_ROOTS,
  REGEX_TECH_ROOTS,
  WEIGHTED_B2B,
  WEIGHTED_B2C,
  WEIGHTED_BRANDING,
  WEIGHTED_CONTENT,
  WEIGHTED_CORPORATE,
  WEIGHTED_DARK_MODE,
  WEIGHTED_EDITORIAL,
  WEIGHTED_EXPLORATORY,
  WEIGHTED_FAST_SCAN,
  WEIGHTED_INDUSTRY_GROUPS,
  WEIGHTED_INDUSTRIAL,
  WEIGHTED_LEAD,
  WEIGHTED_LIGHT_SOFT,
  WEIGHTED_LUXURY,
  WEIGHTED_MINIMAL,
  WEIGHTED_PLAYFUL,
  WEIGHTED_SALES,
  WEIGHTED_SIGNUP,
  WEIGHTED_TECH,
  WEIGHTED_TRUST,
  WEIGHTED_UNIQUENESS,
} from "@/lib/ai/prompt-signal-groups";

const SCORE_CAP_TONE = 36;
const SCORE_CAP_ENERGY = 24;
const SCORE_CAP_GOAL = 28;
const SCORE_CAP_BUSINESS = 28;

function emptyToneScores(): Record<VisualTone, number> {
  return {
    minimal: 0,
    luxury: 0,
    tech: 0,
    industrial: 0,
    editorial: 0,
    playful: 0,
    corporate: 0,
  };
}

function emptyEnergyScores(): Record<VisualEnergy, number> {
  return { calm: 0, balanced: 0, bold: 0 };
}

function emptyGoalScores(): Record<PrimaryGoalInterpreted, number> {
  return {
    lead_generation: 0,
    sales: 0,
    signup: 0,
    branding: 0,
  };
}

function emptyBusinessScores(): Record<BusinessModelInterpreted, number> {
  return {
    service: 0,
    product: 0,
    hybrid: 0,
    content: 0,
    portfolio: 0,
  };
}

export type HeuristicSignalProfile = {
  visualToneScores: Record<VisualTone, number>;
  visualEnergyScores: Record<VisualEnergy, number>;
  primaryGoalScores: Record<PrimaryGoalInterpreted, number>;
  businessModelScores: Record<BusinessModelInterpreted, number>;
  trustRaw: number;
  proofRaw: number;
  restraintRaw: number;
  uniquenessRaw: number;
  scanFastRaw: number;
  scanExploratoryRaw: number;
  phraseHits: string[];
  negationEffects: string[];
  contrastEffects: string[];
  industryHint: string | null;
  /** Canonieke id (bijv. `health_wellness`); zelfde groep als `industryHint` label. */
  industryHintId: string | null;
  tokenHitsApprox: number;
  locale: PromptSignalLocale;
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TOKEN_REGEX_CACHE = new Map<string, RegExp>();

/**
 * Unicode-woordgrenzen: geen match binnen langere tokens (beter dan `\b` voor accenten).
 */
function tokenBoundaryRegex(literal: string): RegExp {
  const trimmed = literal.trim().toLowerCase();
  const before = String.raw`(?:^|(?<![\p{L}\p{N}]))`;
  const after = String.raw`(?![\p{L}\p{N}])`;
  const inner = /\s/.test(trimmed)
    ? trimmed
        .split(/\s+/)
        .filter(Boolean)
        .map(escapeRe)
        .join(String.raw`\s+`)
    : escapeRe(trimmed);
  return new RegExp(before + inner + after, "giu");
}

function getCachedTokenRegex(literal: string): RegExp {
  const key = literal.trim().toLowerCase();
  let re = TOKEN_REGEX_CACHE.get(key);
  if (!re) {
    re = tokenBoundaryRegex(key);
    TOKEN_REGEX_CACHE.set(key, re);
  }
  return re;
}

function countRegexMatches(text: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  return (text.match(r) ?? []).length;
}

/** Som van (aantal treffers × gewicht) voor stringtokens. */
function sumWeightedStringHits(text: string, tokens: WeightedToken[]): number {
  let sum = 0;
  for (const { value, weight } of tokens) {
    if (value.trim().length < 2) continue;
    const re = getCachedTokenRegex(value);
    const m = text.match(re);
    if (m) sum += m.length * weight;
  }
  return sum;
}

function sumWeightedRegexHits(text: string, signals: { re: RegExp; weight: number }[]): number {
  let sum = 0;
  for (const { re, weight } of signals) {
    sum += countRegexMatches(text, re) * weight;
  }
  return sum;
}

/** Voorkomt `lastIndex`-bugs bij hergebruik van globale RegExp in patterns. */
function patternMatches(re: RegExp, text: string): boolean {
  const flags = re.flags.replace(/g/g, "");
  return new RegExp(re.source, flags).test(text);
}

function inferLocale(text: string): PromptSignalLocale {
  const nl = (text.match(/\b(ik|wij|jij|voor|niet|geen|met|naar|website|site|bedrijf|klanten|offerte|aanvraag)\b/giu) ?? []).length;
  const en = (text.match(/\b(the|and|with|our|your|business|website|customers|quote|request)\b/giu) ?? []).length;
  return en > nl + 2 ? "en" : "nl";
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max, n));
}

function clampToneScores(s: Record<VisualTone, number>): void {
  (Object.keys(s) as VisualTone[]).forEach((k) => {
    s[k] = clamp(s[k], SCORE_CAP_TONE);
  });
}

function clampEnergyScores(s: Record<VisualEnergy, number>): void {
  (Object.keys(s) as VisualEnergy[]).forEach((k) => {
    s[k] = clamp(s[k], SCORE_CAP_ENERGY);
  });
}

function clampGoalScores(s: Record<PrimaryGoalInterpreted, number>): void {
  (Object.keys(s) as PrimaryGoalInterpreted[]).forEach((k) => {
    s[k] = clamp(s[k], SCORE_CAP_GOAL);
  });
}

function clampBusinessScores(s: Record<BusinessModelInterpreted, number>): void {
  (Object.keys(s) as BusinessModelInterpreted[]).forEach((k) => {
    s[k] = clamp(s[k], SCORE_CAP_BUSINESS);
  });
}

function addWeighted(scores: Record<string, number>, key: string, delta: number): void {
  scores[key] = (scores[key] ?? 0) + delta;
}

type HitCache = Map<string, number>;

function cached(
  cache: HitCache,
  key: string,
  compute: () => number,
): number {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const v = compute();
  cache.set(key, v);
  return v;
}

function applyContrastEffects(
  effects: string[],
  visualToneScores: Record<VisualTone, number>,
  visualEnergyScores: Record<VisualEnergy, number>,
  trustRaw: { v: number },
): void {
  for (const e of effects) {
    switch (e) {
      case "minimal_up":
        visualToneScores.minimal += 1.5;
        break;
      case "warm_bias":
        visualToneScores.minimal += 0.45;
        visualEnergyScores.calm += 1;
        visualEnergyScores.balanced += 0.35;
        break;
      case "luxury_up":
        visualToneScores.luxury += 1.15;
        break;
      case "luxury_down":
        visualToneScores.luxury *= 0.52;
        break;
      case "luxury_mild":
        visualToneScores.luxury += 0.55;
        visualToneScores.editorial += 0.25;
        break;
      case "playful_down":
        visualToneScores.playful *= 0.62;
        break;
      case "playful_mild":
        visualToneScores.playful += 0.45;
        break;
      case "tech_soft":
        visualToneScores.tech *= 0.82;
        break;
      case "trust_up":
        trustRaw.v += 2;
        break;
      case "corporate_soft":
        visualToneScores.corporate *= 0.72;
        visualEnergyScores.balanced += 0.55;
        break;
      default:
        break;
    }
  }
}

export type ScorePromptSignalsOptions = {
  locale?: PromptSignalLocale | "auto";
};

/**
 * Telt signalen in genormaliseerde prompt; geen eindbeslissing — alleen scores.
 * Stringtokens: unicode-veilige woordgrenzen; groepen worden per run gecached.
 */
export function scorePromptSignals(
  normalizedText: string,
  options?: ScorePromptSignalsOptions,
): HeuristicSignalProfile {
  const t = normalizedText;
  const locale: PromptSignalLocale =
    !options?.locale || options.locale === "auto" ? inferLocale(t) : options.locale;

  const hitCache: HitCache = new Map();

  const wLux = filterWeightedByLocale(WEIGHTED_LUXURY, locale);
  const wMin = filterWeightedByLocale(WEIGHTED_MINIMAL, locale);
  const wTech = filterWeightedByLocale(WEIGHTED_TECH, locale);
  const wInd = filterWeightedByLocale(WEIGHTED_INDUSTRIAL, locale);
  const wEd = filterWeightedByLocale(WEIGHTED_EDITORIAL, locale);
  const wPlay = filterWeightedByLocale(WEIGHTED_PLAYFUL, locale);
  const wCorp = filterWeightedByLocale(WEIGHTED_CORPORATE, locale);
  const wTrust = filterWeightedByLocale(WEIGHTED_TRUST, locale);
  const wLead = filterWeightedByLocale(WEIGHTED_LEAD, locale);
  const wSales = filterWeightedByLocale(WEIGHTED_SALES, locale);
  const wBrand = filterWeightedByLocale(WEIGHTED_BRANDING, locale);
  const wSignup = filterWeightedByLocale(WEIGHTED_SIGNUP, locale);
  const wContent = filterWeightedByLocale(WEIGHTED_CONTENT, locale);
  const wDark = filterWeightedByLocale(WEIGHTED_DARK_MODE, locale);
  const wLight = filterWeightedByLocale(WEIGHTED_LIGHT_SOFT, locale);
  const wUnique = filterWeightedByLocale(WEIGHTED_UNIQUENESS, locale);
  const wFast = filterWeightedByLocale(WEIGHTED_FAST_SCAN, locale);
  const wExplore = filterWeightedByLocale(WEIGHTED_EXPLORATORY, locale);
  const wB2c = filterWeightedByLocale(WEIGHTED_B2C, locale);
  const wB2b = filterWeightedByLocale(WEIGHTED_B2B, locale);

  const rLuxRoots = filterRegexByLocale(REGEX_LUXURY_ROOTS, locale);
  const rEditVintageRoots = filterRegexByLocale(REGEX_EDITORIAL_VINTAGE_ROOTS, locale);
  const rTechRoots = filterRegexByLocale(REGEX_TECH_ROOTS, locale);
  const rLeadStrong = filterRegexByLocale(REGEX_LEAD_STRONG, locale);
  const rCorpSpill = filterRegexByLocale(REGEX_CORPORATE_SPILLOVER, locale);

  const visualToneScores = emptyToneScores();
  const visualEnergyScores = emptyEnergyScores();
  const primaryGoalScores = emptyGoalScores();
  const businessModelScores = emptyBusinessScores();

  let trustRaw = 0;
  let proofRaw = 0;
  let restraintRaw = 0;
  let uniquenessRaw = 0;
  let scanFastRaw = 0;
  let scanExploratoryRaw = 0;

  const phraseHits: string[] = [];
  for (const { re, label } of PHRASE_PATTERNS) {
    if (patternMatches(re, t)) {
      phraseHits.push(label);
      if (label === "strong_lead_goal") {
        addWeighted(primaryGoalScores, "lead_generation", 4);
        addWeighted(primaryGoalScores, "branding", -1);
      }
      if (label === "strong_trust") trustRaw += 3;
      if (label === "restraint_high") restraintRaw += 3;
      if (label === "minimal_calm") {
        visualToneScores.minimal += 2;
        visualEnergyScores.calm += 2;
      }
      if (label === "luxury_minimal") {
        visualToneScores.luxury += 2;
        visualToneScores.minimal += 1;
      }
      if (label === "unique_high") uniquenessRaw += 4;
      if (label === "fast_scan") scanFastRaw += 3;
      if (label === "sales_strong") addWeighted(primaryGoalScores, "sales", 4);
      if (label === "cta_high") addWeighted(primaryGoalScores, "lead_generation", 2);
      if (label === "luxury_phrase") visualToneScores.luxury += 3;
      if (label === "branding_goal") addWeighted(primaryGoalScores, "branding", 3);
      if (label === "content_business") {
        addWeighted(businessModelScores, "content", 4);
        visualToneScores.editorial += 2;
      }
      if (label === "hybrid_commerce") {
        addWeighted(businessModelScores, "hybrid", 4);
        addWeighted(primaryGoalScores, "sales", 2);
      }
      if (label === "corporate_tone") visualToneScores.corporate += 2;
      if (label === "friendly_warm") {
        visualEnergyScores.balanced += 1;
      }
      if (label === "vintage_editorial") {
        visualToneScores.editorial += 5.5;
        visualToneScores.luxury += 1.4;
        visualToneScores.minimal *= 0.82;
      }
    }
  }

  const negationEffects: string[] = [];
  for (const { re, effect } of NEGATION_PATTERNS) {
    if (patternMatches(re, t)) negationEffects.push(effect);
  }

  const luxuryStr = cached(hitCache, "luxury_str", () => sumWeightedStringHits(t, wLux));
  const luxuryRx = cached(hitCache, "luxury_rx", () => sumWeightedRegexHits(t, rLuxRoots));
  const minimalHits = cached(hitCache, "minimal", () => sumWeightedStringHits(t, wMin));
  const techStr = cached(hitCache, "tech_str", () => sumWeightedStringHits(t, wTech));
  const techRx = cached(hitCache, "tech_rx", () => sumWeightedRegexHits(t, rTechRoots));
  const corpSpill = cached(hitCache, "corp_spill", () => sumWeightedRegexHits(t, rCorpSpill));

  const trustProofHits = cached(hitCache, "trust_proof", () => sumWeightedStringHits(t, wTrust));

  trustRaw += trustProofHits * 1.2;
  proofRaw += trustProofHits * 1.0;

  visualToneScores.luxury += (luxuryStr + luxuryRx) * 1.5;
  visualToneScores.minimal += minimalHits * 1.2;
  visualToneScores.tech += (techStr + techRx + corpSpill) * 1.4;
  visualToneScores.industrial += cached(hitCache, "industrial", () => sumWeightedStringHits(t, wInd)) * 1.3;
  visualToneScores.editorial +=
    cached(
      hitCache,
      "editorial",
      () =>
        sumWeightedStringHits(t, wEd) * 1.4 + sumWeightedRegexHits(t, rEditVintageRoots) * 1.35,
    );
  visualToneScores.playful += cached(hitCache, "playful", () => sumWeightedStringHits(t, wPlay)) * 1.3;
  visualToneScores.corporate += cached(hitCache, "corporate", () => sumWeightedStringHits(t, wCorp)) * 1.2;

  if (cached(hitCache, "dark", () => sumWeightedStringHits(t, wDark)) > 0) {
    visualEnergyScores.bold += 1.5;
    visualToneScores.industrial += 0.8;
  }
  if (cached(hitCache, "light", () => sumWeightedStringHits(t, wLight)) > 0) {
    visualEnergyScores.calm += 1.2;
    visualToneScores.minimal += 0.6;
  }

  const leadStr = cached(hitCache, "lead_str", () => sumWeightedStringHits(t, wLead));
  const leadRx = cached(hitCache, "lead_rx", () => sumWeightedRegexHits(t, rLeadStrong));
  const leadTotal = leadStr + leadRx;

  addWeighted(primaryGoalScores, "lead_generation", leadTotal * 1.1);
  addWeighted(primaryGoalScores, "sales", cached(hitCache, "sales", () => sumWeightedStringHits(t, wSales)) * 1.2);
  addWeighted(primaryGoalScores, "branding", cached(hitCache, "brand", () => sumWeightedStringHits(t, wBrand)) * 1.0);
  addWeighted(primaryGoalScores, "signup", cached(hitCache, "signup", () => sumWeightedStringHits(t, wSignup)) * 1.1);

  addWeighted(businessModelScores, "content", cached(hitCache, "content", () => sumWeightedStringHits(t, wContent)) * 1.2);
  addWeighted(
    businessModelScores,
    "product",
    cached(hitCache, "sales_bm", () => sumWeightedStringHits(t, wSales)) * 0.8,
  );
  addWeighted(businessModelScores, "product", (techStr + techRx) * 1.0);
  addWeighted(businessModelScores, "service", leadTotal * 0.5);
  addWeighted(
    businessModelScores,
    "portfolio",
    cached(hitCache, "brand_pf", () => sumWeightedStringHits(t, wBrand)) * 0.6,
  );

  scanFastRaw += cached(hitCache, "fast", () => sumWeightedStringHits(t, wFast)) * 1.2;
  scanExploratoryRaw += cached(hitCache, "explore", () => sumWeightedStringHits(t, wExplore)) * 1.2;
  uniquenessRaw += cached(hitCache, "unique", () => sumWeightedStringHits(t, wUnique)) * 1.5;
  restraintRaw += minimalHits * 0.4;

  let industryHintId: string | null = null;
  let industryHint: string | null = null;
  let bestIndustry = 0;
  for (const row of WEIGHTED_INDUSTRY_GROUPS) {
    const toks = filterWeightedByLocale(row.tokens, locale);
    const c = cached(hitCache, `industry_${row.id}`, () => sumWeightedStringHits(t, toks));
    if (c > bestIndustry) {
      bestIndustry = c;
      industryHintId = row.id;
      industryHint = INDUSTRY_HINT_ID_TO_LABEL[row.id] ?? row.id;
    }
  }
  if (bestIndustry === 0) {
    industryHintId = null;
    industryHint = null;
  }

  const b2c = cached(hitCache, "b2c", () => sumWeightedStringHits(t, wB2c));
  const b2b = cached(hitCache, "b2b", () => sumWeightedStringHits(t, wB2b));
  if (b2c > b2b + 1) addWeighted(businessModelScores, "service", 0.5);
  if (b2b > b2c + 1) visualToneScores.corporate += 0.8;

  const contrastEffects: string[] = [];
  const trustWrap = { v: trustRaw };
  for (const { re, effects } of CONTRAST_PATTERNS) {
    if (patternMatches(re, t)) {
      contrastEffects.push(...effects);
      applyContrastEffects(effects, visualToneScores, visualEnergyScores, trustWrap);
    }
  }
  trustRaw = trustWrap.v;

  if (negationEffects.includes("down_luxury")) visualToneScores.luxury *= 0.35;
  if (negationEffects.includes("down_luxury_soft")) visualToneScores.luxury *= 0.55;
  if (negationEffects.includes("down_playful")) visualToneScores.playful *= 0.35;
  if (negationEffects.includes("warm_bias")) {
    visualToneScores.minimal += 0.5;
    visualEnergyScores.calm += 1;
  }
  if (negationEffects.includes("down_dark")) {
    visualEnergyScores.bold *= 0.5;
    visualToneScores.minimal += 0.5;
  }

  clampToneScores(visualToneScores);
  clampEnergyScores(visualEnergyScores);
  clampGoalScores(primaryGoalScores);
  clampBusinessScores(businessModelScores);

  const tokenHitsApprox =
    luxuryStr + luxuryRx + minimalHits + techStr + techRx + trustProofHits;

  return {
    visualToneScores,
    visualEnergyScores,
    primaryGoalScores,
    businessModelScores,
    trustRaw,
    proofRaw,
    restraintRaw,
    uniquenessRaw,
    scanFastRaw,
    scanExploratoryRaw,
    phraseHits,
    negationEffects,
    contrastEffects,
    industryHint,
    industryHintId,
    tokenHitsApprox,
    locale,
  };
}
