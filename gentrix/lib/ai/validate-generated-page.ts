import type { SiteExperienceModel } from "@/lib/ai/site-experience-model";
import { buildContentClaimDiagnosticsReport } from "@/lib/ai/content-claim-diagnostics";

export type HomepagePlan = {
  experienceModel: string;
  densityProfile: string;
  compositionPlan: {
    layoutArchetype: string;
    visualTension: string;
    motionPersonality: string;
    macroComposition: string;
  };
  navigationModel: {
    searchPriority: string;
  };
  sectionSequence: Array<{
    id: string;
    type: string;
    density: string;
    priority: string;
  }>;
};

export type GeneratedPageValidation = {
  errors: string[];
  warnings: string[];
};

/** Optioneel: agency mode = ruimere heuristieken (minder “template”-waarschuwingen). */
export type ValidateGeneratedPageHtmlOptions = {
  agencyMode?: boolean;
};

/** Eerste `<section id="hero">…</section>` (nested `<section>` in hero wordt meegeteld). */
function sliceHeroSection(html: string): string | null {
  const openRe = /<section\b[^>]*\bid=["']hero["'][^>]*>/i;
  const openMatch = openRe.exec(html);
  if (!openMatch || openMatch.index === undefined) return null;
  const start = openMatch.index;
  const tagRe = /<\/?section\b[^>]*>/gi;
  tagRe.lastIndex = start;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const isClose = /^<\/section/i.test(m[0]);
    if (isClose) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return html.slice(start, m.index + m[0].length);
    }
  }
  return null;
}

/**
 * Lichtgewicht HTML-checks op gejoinde sectie-HTML (geen DOM).
 * Geen auto-retry hier — caller kan loggen of later feedback-loop toevoegen.
 */
export function validateGeneratedPageHtml(
  html: string,
  plan: HomepagePlan,
  opts?: ValidateGeneratedPageHtmlOptions,
): GeneratedPageValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const agency = opts?.agencyMode === true;

  const buttonCount = (html.match(/<button\b/gi) ?? []).length;
  const buttonWarnThreshold = agency ? 14 : 10;
  if (buttonCount > buttonWarnThreshold) {
    warnings.push(
      `Veel buttons (${buttonCount}); overweeg max ~${buttonWarnThreshold} voor rust${agency ? " (agency mode: hogere drempel)" : ""}.`,
    );
  }

  const cardish = (html.match(/\bcard\b/gi) ?? []).length;
  const editorialLean =
    plan.experienceModel === "editorial_content_hub" ||
    plan.experienceModel === "brand_storytelling" ||
    plan.experienceModel === "premium_product";
  const cardBudgetBase =
    plan.densityProfile === "dense_commerce" || plan.experienceModel === "ecommerce_home"
      ? 18
      : editorialLean
        ? 7
        : 10;
  const cardBudget = agency ? Math.ceil(cardBudgetBase * 1.65) : cardBudgetBase;
  if (cardish > cardBudget) {
    warnings.push(
      `Veel ‘card’-verwijzingen (${cardish}); overweeg meer variatie (open vlakken, lijsten, split) als de pagina repetitief oogt.${agency ? " (agency mode: hogere drempel — kaartenrij mag als het past bij retail/features.)" : ""}`,
    );
  }

  const roundedBoxes = (html.match(/\brounded-(xl|2xl|3xl)\b/gi) ?? []).length;
  const borderHits = (html.match(/\bborder(?:-[a-z0-9]+)*\b/gi) ?? []).length;
  const softBgTiles = (html.match(/\bbg-(?:slate|gray|zinc)-50\b/gi) ?? []).length;
  const rbTh = agency ? 22 : 14;
  const bhTh = agency ? 18 : 12;
  const sbTh = agency ? 6 : 4;
  if (roundedBoxes >= rbTh && borderHits >= bhTh && softBgTiles >= sbTh) {
    warnings.push(
      `Veel rounded-xl/2xl + borders + zachte grijze vlakken — kan generiek ogen; overweeg andere ritmes (full-bleed, type-led) als het past bij de briefing.${agency ? " (agency mode: pas waarschuwen bij hogere telling.)" : ""}`,
    );
  }

  if (!/<h1\b/i.test(html)) {
    errors.push("Geen <h1> gevonden (SEO/toegankelijkheid).");
  }

  const heroHtml = sliceHeroSection(html);
  if (heroHtml) {
    const hasCinematicLayer =
      /background-image\s*:\s*url\s*\(/i.test(heroHtml) ||
      /<video\b/i.test(heroHtml) ||
      /images\.unsplash\.com/i.test(heroHtml) ||
      /videos\.pexels\.com/i.test(heroHtml) ||
      /<img\b[^>]*\bsrc=["'][^"']+["']/i.test(heroHtml);
    const hasSubtleDepth =
      /\bbg-gradient-to-/i.test(heroHtml) ||
      /\bbg-\[(?:radial|linear)-gradient/i.test(heroHtml);
    const flatDarkShell =
      /\bbg-black\b/.test(heroHtml) ||
      /\bbg-zinc-950\b/.test(heroHtml) ||
      /\bbg-neutral-950\b/.test(heroHtml) ||
      /\bbg-gray-950\b/.test(heroHtml);
    if (!hasCinematicLayer && !hasSubtleDepth && flatDarkShell) {
      warnings.push(
        "Hero (#hero): effen donker zonder foto én zonder zichtbare gradient/textuur — kan als leeg vlak ogen; overweeg Unsplash-foto of gradient als de briefing dat niet expliciet minimal wil. Achtergrondvideo alleen als de briefing expliciet om beweging/video vraagt.",
      );
    }
  }

  const hasLargeHeading = /text-(6|7|8)xl\b/.test(html);
  if (!agency && !hasLargeHeading && plan.experienceModel !== "saas_landing") {
    warnings.push("Geen zeer grote display-kop (text-6xl+); mag bewust — alleen aanpassen als de briefing impact vraagt.");
  }

  if (plan.navigationModel.searchPriority === "high") {
    const hasSearchUi =
      /type\s*=\s*["']search["']/i.test(html) ||
      (/\bsearch\b/i.test(html) && /input\b/i.test(html)) ||
      /placeholder\s*=\s*["'][^"']*zoek/i.test(html);
    if (!hasSearchUi) {
      errors.push("Zoekprioriteit high maar geen duidelijke zoek-input/zoek-UI gevonden.");
    }
  }

  const layoutAttrs = (html.match(/\bdata-layout\s*=/g) ?? []).length;
  const expectedMin = Math.min(plan.sectionSequence.length, 12);
  if (layoutAttrs > 0 && layoutAttrs < Math.min(3, expectedMin)) {
    warnings.push(`Weinig data-layout attributen (${layoutAttrs}); elke <section> hoort data-layout uit de map.`);
  }

  const claimReport = buildContentClaimDiagnosticsReport(html);
  for (const c of claimReport.items) {
    const line = `[${c.severity === "error" ? "claim-error" : "claim-warn"} — ${c.code} @${c.index}] ${c.match}`;
    if (c.severity === "error") errors.push(line);
    else warnings.push(line);
  }

  return { errors, warnings };
}

/** Optionele score 0–100 voor benchmarks (los van productie-validator). */
export function scoreOutputForExperienceModel(html: string, model: SiteExperienceModel): number {
  let score = 0;
  if (/text-(6|7|8)xl\b/.test(html)) score += 10;
  if (/tracking-tight/.test(html)) score += 5;
  if (/font-(bold|black)\b/.test(html)) score += 5;
  if (/md:col-span-2\b|lg:col-span-2\b|grid-cols-2\b/.test(html)) score += 8;
  if (!/grid-cols-1\s+md:grid-cols-3\b/.test(html)) score += 5;
  if (/bg-gradient-to-/.test(html)) score += 10;
  if (/shadow-(xl|2xl)\b/.test(html)) score += 5;
  if (/blur-3xl\b/.test(html)) score += 8;
  if (model === "ecommerce_home" && /zoek|search|category|categor/i.test(html)) score += 15;
  if (model === "editorial_content_hub" && /article|verhaal|lees|story/i.test(html)) score += 15;
  if (model === "service_leadgen" && /afspraak|contact|boek|plan/i.test(html)) score += 15;
  return Math.min(100, score);
}
