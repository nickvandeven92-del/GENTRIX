import { applyResolverConfidenceToLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import { getEffectiveHeroExpression } from "@/lib/ai/above-fold-archetypes";
import { buildPageCompositionBiasFromHeroExpression } from "@/lib/ai/page-composition-bias";
import type {
  AboveFoldArchetypeId,
  HeroExpression,
  SiteIntent,
} from "@/lib/ai/site-experience-model";
import type { ResolverConfidenceLayoutOptions } from "@/lib/ai/apply-resolver-confidence-to-layout-options";
import type { PageCompositionBias } from "@/lib/ai/page-composition-bias";

/**
 * Compositie-architectuur (niet verspreiden):
 * - **Interpretatie + conflictdominantie:** alleen hier (`normalizeSiteIntentCompositionConsistency`).
 * - **Zekerheid → strengheid:** `applyResolverConfidenceToLayoutOptions`.
 * - **Hero-gedreven page bias:** `buildPageCompositionBiasFromHeroExpression`.
 * - **Pool-mutatie:** `apply-layout-pool-bias` + `studio-prompt-layout-maps` (consumptie, geen nieuwe semantiek).
 * - **Sectieritme:** `build-homepage-plan` (consumptie van `rhythmBias` + character-nudge).
 */
export type CompositionConflictDecision = {
  /** Wint (dominant) — geen gemiddelde, expliciete winnaar. */
  winningSignal: string;
  /** Verliest t.o.v. winnaar. */
  suppressedSignal: string;
  reason: string;
};

export type ResolvedCompositionPlan = {
  normalizedSiteIntent: SiteIntent;
  layoutOptions: ResolverConfidenceLayoutOptions;
  pageCompositionBias: PageCompositionBias;
  /** Machine-leesbaar: wie won t.o.v. wie. */
  conflictDecisions: CompositionConflictDecision[];
  /** Afgeleid uit `conflictDecisions` (backward compat / logs). */
  conflictsResolved: string[];
};

const EDITORIAL_LIKE: readonly HeroExpression[] = [
  "editorial_calm",
  "immersive_overlay",
  "minimal_typographic",
];

const CONVERSION_HEAVY_ARCH: readonly AboveFoldArchetypeId[] = [
  "dense_commerce_stage",
  "product_split_conversion",
];

const FLASHY_CAMPAIGN_ARCH: readonly AboveFoldArchetypeId[] = [
  "integrated_campaign_media",
  "dense_commerce_stage",
];

const SOFT_EDITORIAL_ARCH: readonly AboveFoldArchetypeId[] = [
  "editorial_full_bleed",
  "minimal_statement",
];

function decision(
  winningSignal: string,
  suppressedSignal: string,
  reason: string,
): CompositionConflictDecision {
  return { winningSignal, suppressedSignal, reason };
}

function decisionsToStrings(d: CompositionConflictDecision[]): string[] {
  return d.map(
    (x) =>
      `dominance:${x.winningSignal}>${x.suppressedSignal} — ${x.reason}`,
  );
}

/**
 * `heroExpression` wint bij clash — archetype wordt bijgestuurd, niet “gemiddeld”.
 */
function normalizeSiteIntentCompositionConsistency(siteIntent: SiteIntent): {
  siteIntent: SiteIntent;
  conflictDecisions: CompositionConflictDecision[];
} {
  const decisions: CompositionConflictDecision[] = [];
  const hero = siteIntent.heroExpression;
  const arch = siteIntent.aboveFoldArchetypeId;

  if (!hero || !arch) {
    return { siteIntent, conflictDecisions: decisions };
  }

  if (EDITORIAL_LIKE.includes(hero) && CONVERSION_HEAVY_ARCH.includes(arch)) {
    let next: AboveFoldArchetypeId = "editorial_full_bleed";
    if (hero === "immersive_overlay") next = "immersive_overlay_statement";
    if (hero === "minimal_typographic") next = "minimal_statement";
    decisions.push(
      decision(
        `heroExpression:${hero}`,
        `aboveFoldArchetypeId:${arch}`,
        "Hero-expression (editorial/immersive/minimal) is dominant; conversion-heavy archetype wordt vervangen — geen middeling naar generieke commerce-layout.",
      ),
    );
    return {
      siteIntent: { ...siteIntent, aboveFoldArchetypeId: next },
      conflictDecisions: decisions,
    };
  }

  if (hero === "service_trust" && FLASHY_CAMPAIGN_ARCH.includes(arch)) {
    const next: AboveFoldArchetypeId = "service_conversational";
    decisions.push(
      decision(
        `heroExpression:service_trust`,
        `aboveFoldArchetypeId:${arch}`,
        "Service/trust-modus wint; campaign/commerce-flash archetype wordt onderdrukt.",
      ),
    );
    return {
      siteIntent: { ...siteIntent, aboveFoldArchetypeId: next },
      conflictDecisions: decisions,
    };
  }

  if (
    (hero === "integrated_campaign" || hero === "commerce_dense") &&
    SOFT_EDITORIAL_ARCH.includes(arch)
  ) {
    const next: AboveFoldArchetypeId =
      hero === "commerce_dense" ? "dense_commerce_stage" : "integrated_campaign_media";
    decisions.push(
      decision(
        `heroExpression:${hero}`,
        `aboveFoldArchetypeId:${arch}`,
        "Campaign/commerce-expression wint; te zacht editoriaal archetype wordt vervangen door uitvoering die bij koopdruk hoort.",
      ),
    );
    return {
      siteIntent: { ...siteIntent, aboveFoldArchetypeId: next },
      conflictDecisions: decisions,
    };
  }

  return { siteIntent, conflictDecisions: decisions };
}

export function resolveCompositionPlan(input: { siteIntent: SiteIntent }): ResolvedCompositionPlan {
  const { siteIntent: normalized, conflictDecisions } = normalizeSiteIntentCompositionConsistency(
    input.siteIntent,
  );
  const layoutOptions = applyResolverConfidenceToLayoutOptions(normalized.resolverConfidence);
  const pageCompositionBias = buildPageCompositionBiasFromHeroExpression({
    heroExpression: getEffectiveHeroExpression(normalized),
    aboveFoldArchetypeId: normalized.aboveFoldArchetypeId,
  });

  return {
    normalizedSiteIntent: normalized,
    layoutOptions,
    pageCompositionBias,
    conflictDecisions,
    conflictsResolved: decisionsToStrings(conflictDecisions),
  };
}
