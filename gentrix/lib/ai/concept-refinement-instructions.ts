import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import { SITE_SIGNATURE_ARCHETYPE_LABELS } from "@/lib/ai/site-signature-schema";

export type ConceptRefinementDirection = "strakker_zakelijk" | "durfder_editorial" | "meer_beweging" | "transparante_navbar";

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
 * (API: optioneel \`target_section_indices\` om alleen bepaalde secties volledig mee te sturen; bij
 * conceptverfijning meestal **weglaten** — richting raakt vaak hero + meerdere secties.)
 * Site-assistent (\`/api/ai-site-chat\`) gebruikt dezelfde scope: inferentie uit sectienaam/id/semanticRole in het
 * bericht, of expliciet \`target_section_indices\` in de JSON-body.
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
    case "transparante_navbar":
      return `${refinementBase}${sig}
=== RICHTING: TRANSPARANTE NAVBAR (overlay hero + scroll-effect) ===
Dit is een expliciete stijl-override — volg onderstaande technische aanpak precies.

**Doel:** de navbar zweeft transparant over de hero (geen witte balk erboven); zodra de bezoeker scrolt krijgt hij een vaste, gekleurde achtergrond.

**Technische uitvoering (verplicht):**
- Verander de buitenste \`<header>\` van \`sticky top-0\` naar \`fixed inset-x-0 top-0\` — dit is voor dit patroon **expliciet toegestaan** (uitzondering op de algemene sticky-voorkeur).
- Voeg Alpine-state toe: \`x-data="{ scrolled: false }"\` + \`@scroll.window="scrolled = (window.scrollY > 60)"\` op de \`<header>\`.
- Combineer transparant/gescrold in **één** \`:class\`-binding: \`:class="scrolled ? 'bg-white shadow-md text-slate-900' : 'bg-transparent text-white'"\` plus vaste classes \`class="fixed inset-x-0 top-0 z-50 transition-all duration-300"\`.
- **Hero-sectie:** voeg bovenaan de hero \`pt-[4rem] lg:pt-[5rem]\` (of passende padding) toe zodat de content niet achter de fixed navbar verdwijnt.
- Hamburger-icoon: wit boven hero, donker na scrollen — via dezelfde Alpine-state (\`:class\` op de hamburger-lijntjes).
- Wijzig **alleen** de navbar-sectie en indien nodig de hero-sectie (padding-top); pas geen andere secties aan.
`;
    default: {
      const _exhaustive: never = direction;
      return _exhaustive;
    }
  }
}
