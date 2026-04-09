import type { SiteConfig } from "@/lib/ai/build-site-config";
import type { DesignPersonality } from "@/lib/ai/design-personality";
import {
  applyIndustryVisualBiasIfAmbiguous,
  shouldApplyIndustryVisualBias,
} from "@/lib/ai/apply-industry-bias-if-ambiguous";
import type { PromptInterpretation } from "@/lib/ai/prompt-interpretation-types";
import type { HeuristicSignalProfile } from "@/lib/ai/score-prompt-signals";

/** Op `normalizePrompt` / `preparePromptForInterpretation().normalized` toe te passen. */
const BARBER_OR_GROOMING_RE =
  /\b(barbier|barbershop|barber|kapper|kapsalon|herenkapper|baard|fade|knipbeurt|knip|scheer)\b/;

const DARK_SURFACE_RE =
  /\b(donker|zwart|antraciet|charcoal|near\s*-?\s*black|deep\s+black|zwartbruin|warm\s+antraciet|dark\s+theme|donkere\s+basis|donker\s+warm|geen\s+brede\s+witte|geen\s+witte\s+secties)\b/;

export function promptHintsBarberOrGrooming(normalizedPrompt: string): boolean {
  const t = normalizedPrompt.trim();
  if (!t) return false;
  return BARBER_OR_GROOMING_RE.test(t);
}

export function promptHintsDarkSurface(normalizedPrompt: string): boolean {
  const t = normalizedPrompt.trim();
  if (!t) return false;
  return DARK_SURFACE_RE.test(t);
}

function shouldPreferMinimalDarkPreset(i: PromptInterpretation, normalizedPrompt: string): boolean {
  if (!promptHintsDarkSurface(normalizedPrompt)) return false;
  if (promptHintsBarberOrGrooming(normalizedPrompt)) return true;
  if (i.visualTone === "luxury" || i.visualTone === "editorial") return true;
  return false;
}

function maxPersonality(scores: Record<DesignPersonality, number>): DesignPersonality {
  const order: DesignPersonality[] = [
    "bold_industrial",
    "elegant_luxury",
    "playful_creative",
    "minimal_tech",
    "editorial_art",
    "trust_conversion",
  ];
  let best: DesignPersonality = "minimal_tech";
  let v = -1;
  for (const p of order) {
    const s = scores[p] ?? 0;
    if (s > v) {
      v = s;
      best = p;
    }
  }
  return best;
}

/**
 * Personality-scores afgeleid van interpretatie, **zonder** branche-bias.
 * Gebruikt voor zowel eindkeuze als ambiguïteitscheck (brand_style).
 */
export function buildBasePersonalityScores(i: PromptInterpretation): Record<DesignPersonality, number> {
  const s: Record<DesignPersonality, number> = {
    bold_industrial: 0,
    elegant_luxury: 0,
    playful_creative: 0,
    minimal_tech: 1,
    editorial_art: 0,
    trust_conversion: 0,
  };

  if (i.visualTone === "luxury") s.elegant_luxury += 4;
  if (i.visualTone === "industrial") s.bold_industrial += 4;
  if (i.visualTone === "editorial") s.editorial_art += 4;
  if (i.visualTone === "playful") s.playful_creative += 4;
  if (i.visualTone === "tech") s.minimal_tech += 3;
  if (i.visualTone === "corporate") {
    s.minimal_tech += 2;
    s.trust_conversion += 1;
  }
  if (i.visualTone === "minimal") s.minimal_tech += 3;

  if (i.visualEnergy === "bold") {
    s.bold_industrial += 1.5;
    s.editorial_art += 1;
  }
  if (i.visualEnergy === "calm") {
    s.elegant_luxury += 1;
    s.minimal_tech += 1;
  }

  if (i.trustNeed === "high" && (i.primaryGoal === "lead_generation" || i.ctaUrgency === "high")) {
    s.trust_conversion += 3;
  }
  if (i.proofNeed === "high") s.trust_conversion += 2;

  if (i.uniquenessNeed === "high") s.editorial_art += 2;

  if (i.emotionalTone === "aspirational") s.elegant_luxury += 1.5;
  if (i.emotionalTone === "friendly") s.playful_creative += 1.5;

  return s;
}

/**
 * Abstracte interpretatie → layout-personality (pools + promptregels).
 * Branche via `profile.industryHintId` alleen bij zwakke of ambigue prompt-signalen.
 */
export function resolvePersonalityFromInterpretation(
  i: PromptInterpretation,
  profile?: HeuristicSignalProfile | null,
): DesignPersonality {
  const s = buildBasePersonalityScores(i);
  applyIndustryVisualBiasIfAmbiguous(s, profile);
  return maxPersonality(s);
}

/** Preset-id compatibel met `resolveBrandStyleToPresetId`. */
export function resolveBrandStyleFromInterpretation(
  i: PromptInterpretation,
  profile?: HeuristicSignalProfile | null,
  /** Genormaliseerde prompt (`preparePromptForInterpretation`) voor donker/barbier-heuristiek. */
  normalizedPrompt?: string,
): SiteConfig["brand_style"] {
  const p = normalizedPrompt?.trim() ?? "";
  const baseScores = buildBasePersonalityScores(i);

  if (p && shouldPreferMinimalDarkPreset(i, p)) {
    return "minimal_dark";
  }

  if (i.visualTone === "luxury") return "luxury";
  if (i.visualTone === "playful") return "playful";
  if (i.visualTone === "corporate") return "corporate";
  if (i.visualTone === "tech" || (i.businessModel === "product" && i.primaryGoal === "signup")) {
    return "tech_saas";
  }
  if (i.businessModel === "product" && i.primaryGoal === "sales") return "commerce_grid";
  /** Magazine/serif/karakter — niet `minimal_light` (dat is tech-SaaS-achtig licht). */
  if (i.visualTone === "editorial") return "editorial";
  /** Metaal, bouw, craft: donkere basis + accent (niet standaard wit “SaaS”). */
  if (i.visualTone === "industrial") return "minimal_dark";

  const healthOrganic =
    profile != null
      ? shouldApplyIndustryVisualBias(profile, baseScores) && profile.industryHintId === "health_wellness"
      : Boolean(i.industryHint?.includes("zorg") || i.industryHint?.includes("welzijn"));
  if (healthOrganic) return "organic_soft";

  return "minimal_light";
}

export function resolvePrimaryGoalString(i: PromptInterpretation): SiteConfig["primary_goal"] {
  if (i.primaryGoal === "signup") return "signup";
  return i.primaryGoal;
}

export function resolveTargetAudienceDescription(
  i: PromptInterpretation,
  normalizedPrompt?: string,
): string {
  const p = normalizedPrompt?.trim() ?? "";
  if (p && promptHintsBarberOrGrooming(p) && !/\b(b2b|groothandel|alleen\s+zakelijk)\b/.test(p)) {
    return "particuliere klanten (lokale bezoekers, heren); B2C";
  }

  const ind = i.industryHint?.trim();
  if (i.audienceType === "business") {
    if (ind) return `zakelijke beslissers en teams (${ind})`;
    return "zakelijke beslissers en professionele doelgroepen";
  }
  if (i.audienceType === "consumer") {
    if (ind) return `particuliere klanten en consumenten (${ind})`;
    return "particuliere klanten en consumenten";
  }
  if (ind) return `gemengd publiek; branchecontext: ${ind}`;
  return "kleine en middelgrote organisaties, zelfstandigen en particulieren (gemengd)";
}
