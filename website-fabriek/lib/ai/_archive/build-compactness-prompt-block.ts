import type { HomepageCompactnessPlan } from "@/lib/ai/homepage-compactness-plan";
import type { CompactnessProfile } from "@/types/pageCompactness";
import type { SectionContentBudget } from "@/types/sectionContentBudget";

function buildCompactnessPromptBody(compactness: CompactnessProfile, budget: SectionContentBudget): string {
  return `## PAGE COMPACTNESS RULES
- Page length target: ${compactness.pageLengthTarget}
- Section density: ${compactness.sectionDensity}
- Content compression: ${compactness.contentCompression}

### HARD LIMITS
- Maximum primary sections before footer: ${compactness.maxPrimarySections}
- Maximum CTA sections: ${compactness.maxCtaSections}
- Maximum narrative sections: ${compactness.maxNarrativeSections}
- Maximum card-grid sections: ${compactness.maxCardGridSections}
- Maximum cards/items per section: ${budget.maxItems}
- Maximum bullets per item: ${budget.maxBulletsPerItem}
- Maximum paragraph characters: ${budget.maxBodyChars}
- Maximum stats in one block: ${budget.maxStats}
- Maximum FAQ items: ${budget.maxFaqItems}
- Maximum testimonials: ${budget.maxTestimonials}
- Maximum portfolio items: ${budget.maxPortfolioItems}
- Maximum nav links (global/footer lists): ${budget.maxNavLinks}
- Maximum footer columns: ${budget.maxFooterColumns}

### LAYOUT BEHAVIOR
- Prefer merged sections: ${compactness.preferMergedSections ? "yes" : "no"}
- Prefer hero with embedded proof: ${compactness.preferHeroWithEmbeddedProof ? "yes" : "no"}
- Allow dedicated about section: ${compactness.allowDedicatedAboutSection ? "yes" : "no"}
- Allow large footer: ${compactness.allowLargeFooter ? "yes" : "no"}

### PREFER
- Liever geen herhaling van dezelfde trust-claim in meerdere secties
- Geen aparte about-sectie tenzij de briefing het nodig maakt
- Geen lege verticale ruimte als truc; geen oversized kaarten met dunne copy
- **Binnen één sectie-HTML:** niet meerdere volledige marketinglagen stapelen (statistieken + “waarom wij” + testimonialraster + keurmerken + extra CTA) als dat samen weer een halve pagina wordt — kies **één** compact proof-moment of laat proof weg als de briefing geen feiten geeft
- Houd je **ongeveer** binnen de budgetten — overschrijden alleen als de briefing duidelijk meer structuur vraagt`;
}

/** Gebruik deze variant zodat compactness en budget uit dezelfde `buildHomepageCompactnessPlan`-run komen. */
export function buildCompactnessPromptBlock(plan: HomepageCompactnessPlan): string;
export function buildCompactnessPromptBlock(
  compactness: CompactnessProfile,
  budget: SectionContentBudget,
): string;
export function buildCompactnessPromptBlock(
  compactnessOrPlan: CompactnessProfile | HomepageCompactnessPlan,
  budget?: SectionContentBudget,
): string {
  if (budget !== undefined) {
    return buildCompactnessPromptBody(compactnessOrPlan as CompactnessProfile, budget);
  }
  const plan = compactnessOrPlan as HomepageCompactnessPlan;
  return buildCompactnessPromptBody(plan.compactness, plan.contentBudget);
}
