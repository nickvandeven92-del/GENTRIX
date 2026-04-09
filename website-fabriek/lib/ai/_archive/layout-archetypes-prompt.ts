import type { CompositionPlan } from "@/lib/ai/build-homepage-plan";
import { LAYOUT_ARCHETYPES, type LayoutArchetype } from "@/types/layoutArchetypes";

export type BuildLayoutArchetypesPromptOptions = {
  /** Zelfde volgorde als \`_site_config.sections\` — voor ritme-instructies. */
  sectionOrder?: string[];
  /** Macro-compositie uit \`HomepagePlan\`; staat **boven** deze sectie-map. */
  compositionPlan?: CompositionPlan;
};

function buildSectionRhythmLines(
  map: Record<string, LayoutArchetype>,
  sectionOrder: string[],
): string {
  if (sectionOrder.length === 0) return "";
  return sectionOrder
    .map((id, i) => {
      const arch = map[id];
      const archHint = arch ? ` (\`${arch}\`)` : "";
      if (i === 0) {
        return `- **${id}**${archHint} — eerste band: maximale visuele spanning; nav + hero volgen het gekozen archetype (geen slap begin).`;
      }
      if (i % 2 === 1) {
        return `- **${id}**${archHint} — **dichtere** band: inhoudsritme (kolommen, tijdlijn, split met beeld) — **niet** automatisch “alles in kaarten”; typografie en uitlijning mogen de structuur dragen i.p.v. borders om elk blok.`;
      }
      return `- **${id}**${archHint} — **adem**-band: royale witruimte, open canvas of zacht tonal field; kan één sterk full-bleed beeld, zachte gradient of display-typografie als anker (geen lege witte vlakte zonder focus).`;
    })
    .join("\n");
}

/**
 * Prompt-blok: koppelt sectie-id’s aan layout-archetypes + slot-namen voor Claude HTML (`data-layout` / `data-slot`).
 *
 * Archetypen zijn geen vrijbrief voor identieke card-tegels — zie **LOVABLE 2.0** + §0A compositie-mandaat (minstens één band breekt het ritme).
 */
export function buildLayoutArchetypesPromptBlock(
  map: Record<string, LayoutArchetype>,
  options?: BuildLayoutArchetypesPromptOptions,
): string {
  const used = [...new Set(Object.values(map))];
  const slotLines = used.map((id) => {
    const c = LAYOUT_ARCHETYPES[id];
    const slots = c.slotOrder.map((s) => `\`${s}\``).join(", ");
    return `- **${id}** → slots (in volgorde): ${slots}`;
  });

  const sectionOrder =
    options?.sectionOrder?.length ? options.sectionOrder : Object.keys(map);

  const qr = options?.compositionPlan?.qualityReport;
  const qualityLine =
    qr != null
      ? `**Compositie-kwaliteit (intern):** score ${qr.score}/100${qr.fixes.length ? ` — aandacht: ${qr.fixes.slice(0, 3).join("; ")}` : ""}\n\n`
      : "";

  const macro = options?.compositionPlan?.layoutArchetype;
  const macroNote =
    macro === "saas_proof_ladder"
      ? `\n**Let op:** deze macro heet intern \`saas_proof_ladder\` maar bedoelt een **generieke conversiestory** (ook pretparken, events, hospitality). Vertaal naar **bestemming/editorial** — geen standaard SaaS-icoonraster.\n`
      : "";

  const compositionHeader = options?.compositionPlan
    ? `=== COMPOSITIE → LAYOUT (hiërarchie) ===

**Macro (al in SITE INTENT):** \`layout_archetype\` = \`${options.compositionPlan.layoutArchetype}\` — beschrijft de **paginahouding**. **Visuele spanning:** ${options.compositionPlan.visualTension}
${macroNote}
${qualityLine}**Ondergeschikt:** \`_layout_archetypes\` hieronder koppelt **canonieke sectie-id’s** (uit \`_site_config.sections\`) aan concrete \`data-layout\` + \`data-slot\`. Dat is de **vertaling** van zones naar HTML-blokken — niet de omgekeerde richting. Kies innerlijke compositie (overlap, full-bleed, typografie) zodat het past bij \`visual_tension\` en \`motion_personality\`.

`
    : "";

  const rhythmBlock =
    sectionOrder.length > 0
      ? `

=== SECTION RHYTHM (page flow — follow _site_config.sections order) ===

Alternate visual **density** so the page is not one flat stack of identical boxed cards — denk **editorial page flow** (rust ↔ spanning), niet “component library”:

${buildSectionRhythmLines(map, sectionOrder)}
`
      : "";

  return `${compositionHeader}=== LAYOUT ARCHETYPES (structuur in HTML — ondergeschikt aan macro-compositie) ===

**Site chrome:** primaire nav-host = exact \`_design_preset.navigation.wrapper\` (**sticky top-0** tenzij uitzondering in PREMIUM-contract voor overlay-hero).

**Editorial note:** archetypes = **compositie + slot-semantiek** per sectie-id, niet “alles in \`surfaces.card\`”. Witruimte, type-schaal, overlap en full-bleed media gaan vóór boxed cards — in lijn met \`compositionPlan.visual_tension\`.

_layout_archetypes — koppelt elke **geplande sectie-\`id\`** (canoniek) aan precies één archetype-id (letterlijk op de buitenste \`<section>\`):

${JSON.stringify(map, null, 2)}

**Mandatory HTML attributes (in addition to \`id\` on the outer \`<section>\`):**

1. On the **outermost** \`<section>\` for each mapped section: add \`data-layout="<archetype-id>"\` using the value from \`_layout_archetypes\` for that section’s JSON \`id\`.
2. Wrap each **major** content block inside that section in a container (usually \`<div>\`) with \`data-slot="<slot-name>"\`. Slot names MUST come from the archetype’s list below. Use slots **top-to-bottom** in narrative order: first block → first slot, second → second slot, etc. If you have fewer blocks than slots, use the first N slots only. If you need more wrappers than slots, group related content inside one slotted wrapper.
3. Do not invent new \`data-layout\` or \`data-slot\` strings — only ids from this message.

**Navbar + hero (when \`data-layout\` starts with \`hero_nav_\`):**

- First slot is \`navigation\`. Pick **one** distinctive pattern (centered under wordmark, floating pill, two-row bar, split stack) — align with user **§0A** nav mandate for this run.
- **Dark / video / full-bleed:** nav **on** the media with dark glass + light links — **not** a separate solid **white** bar above the hero (**§0A2** + **LOVABLE 2.0** point 6).
- Avoid default “logo left + links + CTA right” unless content truly demands it.
- **\`hero_nav_split_product\`:** after \`navigation\`, \`media\` and \`content\` must sit **side-by-side from \`md:\`** (inner \`grid md:grid-cols-2\` or flex row); on mobile stack with media first or second per best UX.

**Split / grid archetypes:**

- **\`content_faq_two_column\`:** \`intro\` spans **full width** above the columns (\`md:col-span-2\` on the intro wrapper inside a grid, or intro outside the 2-col grid).
- **\`content_pricing_split_lead\`:** \`intro\` = copy column; \`plans_grid\` = pricing **offers** (één tier mag visueel uitgelicht; de rest mag rustiger/open — geen verplichte identieke drie “dozen”).
- **\`testimonials_split_spotlight\`:** \`spotlight_quote\` is the large focal quote; \`supporting_stack\` holds secondary quotes or logos — not three equal cards.
- **\`cta_floating_card\`:** interpreteer als **zwevend, compact UI-vlak** (pill/bar boven het canvas) — **niet** als excuus om de hele hero in een dikke bordered box te stoppen.

**Avoid (boring stacks):** same “three equal icon cards” reused across features + pricing + testimonials; flat pricing triplets without a clear hero tier; testimonial section that is only one tiny card when the archetype expects breadth; FAQ without hierarchy. **Global:** long flat bands without preset \`effects.*\` / imagery / tonal shift — see **LOVABLE 2.0** + **PREMIUM** preset rules.

**Slot reference (archetypes used in this run):**

${slotLines.join("\n")}
${rhythmBlock}
`;
}
