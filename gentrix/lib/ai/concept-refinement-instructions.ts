import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import { SITE_SIGNATURE_ARCHETYPE_LABELS } from "@/lib/ai/site-signature-schema";

export type ConceptRefinementDirection = "strakker_zakelijk" | "durfder_editorial" | "meer_beweging";

function formatSignatureBlock(contract: DesignGenerationContract | null): string {
  if (!contract?.siteSignature) return "";
  const s = contract.siteSignature;
  const label = SITE_SIGNATURE_ARCHETYPE_LABELS[s.archetype];
  return `

=== SITE-SIGNATURE (behouden — zelfde run als Denklijn) ===
- **Archetype:** \`${s.archetype}\` — ${label}
- **Commitment:** ${s.commitment_nl}
- **Anti-templates:** ${s.anti_templates_nl.join(" · ")}
- Je mag de uitwerking **scherper maken** in lijn met de gekozen richting hieronder, maar **niet** de signature vervangen door generieke SaaS-stijl tenzij dat een harde fout of claim-conflict oplost.
`;
}

const refinementBase = `Studio: **conceptverfijning** (lichte tweede pass — **niet** opnieuw van nul).
- **Behoud** alle sectie-\`id\`'s en de **volgorde** van secties.
- **Minimaal wijzigen:** alleen \`sectionUpdates\` voor secties die je echt aanpast; **geen** ongewijzigde secties opnieuw uitschrijven.
- **Geen dubbele site-nav:** maximaal één globale \`<header>\`/\`<nav>\` met hoofdlinks.
`;

/**
 * Instructie voor \`editSiteWithClaude\` / \`/api/ai-edit-site\` — korte tweede pass na generatie.
 */
export function buildConceptRefinementInstruction(
  direction: ConceptRefinementDirection,
  contract: DesignGenerationContract | null,
): string {
  const sig = formatSignatureBlock(contract);
  switch (direction) {
    case "strakker_zakelijk":
      return `${refinementBase}${sig}
=== RICHTING: STRAKKER / ZAKELIJK ===
- Minder decoratie en visuele drukte; strakkere typografie, spacing en hiërarchie.
- Hero compacter en directer; knip overbodige marketing-“vulling” (lange alinea’s, dubbele CTA-banen).
- Kaarten/lijsten: minder schaduw/gradient-theater tenzij het leesbaarheid verbetert.
`;
    case "durfder_editorial":
      return `${refinementBase}${sig}
=== RICHTING: DURFDER / EDITORIAL ===
- Sterkere compositie: meer contrast, duidelijker visueel ritme (witruimte of juist één dramatische band).
- Vermijd het standaard “3 gelijke feature-kaarten”-gevoel tenzij de briefing expliciet om pijlers vraagt — kies split, asymmetrie of editorial typografie.
- Hero: één duidelijk visueel anker (beeld of type) dat bij de briefing past; geen cliché-stock tenzij sector-passend.
`;
    case "meer_beweging":
      return `${refinementBase}${sig}
=== RICHTING: MEER BEWEGING (binnen studio-regels) ===
- Voeg **meer** \`data-animation\` / \`data-aos\` toe op zichtbare blokken (fade-up, stagger) — **niet** op dezelfde node beide attributen.
- \`studio-border-reveal\` spaarzaam maar consequent op koppen of sectiescheidingen waar het de briefing ondersteunt.
- **Verboden:** marquee/ticker, \`studio-marquee\`, nieuwe \`studio-laser-*\` tenzij cyber/neon expliciet in de briefing.
`;
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
