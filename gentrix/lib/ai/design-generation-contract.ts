import { z } from "zod";

/**
 * Machine-leesbaar “designcontract” uit de Denklijn-fase: gaat de generator- en zelfreview-prompt in
 * zodat visuele keuzes (hero, palet, beeld, motion) aansluiten bij dezelfde run.
 */
export const designGenerationContractSchema = z.object({
  heroVisualSubject: z.string().min(5).max(800),
  heroImageSearchHints: z.string().max(500).optional(),
  paletteMode: z.enum(["light", "dark", "either"]),
  primaryPaletteNotes: z.string().max(400).optional(),
  imageryMustReflect: z.array(z.string().min(1)).min(1).max(12),
  imageryAvoid: z.array(z.string()).max(12).optional().default([]),
  motionLevel: z.enum(["none", "subtle", "moderate", "strong"]),
  toneSummary: z.string().max(500).optional(),
});

export type DesignGenerationContract = z.infer<typeof designGenerationContractSchema>;

/** JSON-envelop die het rationale-model één keer levert. */
export const designRationaleEnvelopeSchema = z.object({
  rationale_nl: z.string().min(60).max(14_000),
  contract: z.unknown(),
});

/**
 * Tekstblok dat aan de site-generatie-userprompt wordt gehangen (bindend naast de briefing).
 */
export function buildDesignContractPromptInjection(
  contract: DesignGenerationContract,
  referenceSnap?: { url: string } | null,
): string {
  const avoid =
    contract.imageryAvoid && contract.imageryAvoid.length > 0
      ? contract.imageryAvoid.join(", ")
      : "(geen extra vermijdingen in contract — volg briefing)";
  const must = contract.imageryMustReflect.join(", ");
  const motionNl =
    contract.motionLevel === "none"
      ? "Geen decoratieve motion toevoegen tenzij de briefing motion expliciet vraagt."
      : contract.motionLevel === "subtle"
        ? "Subtiele motion (spaarzaam `data-animation`, lichte border-reveal waar passend)."
        : contract.motionLevel === "moderate"
          ? "Merkbare maar nette motion (meerdere `data-animation`, border-reveal/marquee waar de briefing dat ondersteunt)."
          : "Sterke motion passend bij de briefing (ruim `data-animation`, border-reveal, evt. `studio-marquee`).";

  const paletteNl =
    contract.paletteMode === "light"
      ? "Overwegend licht thema: lichte achtergronden, sterk leesbaar contrast."
      : contract.paletteMode === "dark"
        ? "Overwegend donker thema: diepe achtergronden, lichte tekst met goed contrast."
        : "Licht of donker is toegestaan, maar kies één duidelijke hoofdrichting (geen willekeurige mix).";

  const lines = [
    "Je **moet** deze afspraken in `config` (thema/kleuren) en in de **hero** en overige beelden concreet maken — **tenzij** de briefing hier **expliciet** mee in strijd is (dan wint altijd de briefing).",
    "",
    `- **Hero-visueel:** ${contract.heroVisualSubject}`,
    ...(contract.heroImageSearchHints
      ? [`- **Zoekhints voor hero/stock (sluit aan bij onderwerp):** ${contract.heroImageSearchHints}`]
      : []),
    `- **Palett:** ${paletteNl}${contract.primaryPaletteNotes ? ` Verder: ${contract.primaryPaletteNotes}` : ""}`,
    `- **Beeldthema (must):** ${must}`,
    `- **Vermijd als dominant beeld:** ${avoid}`,
    `- **Motion:** ${motionNl}`,
    ...(contract.toneSummary ? [`- **Toon copy:** ${contract.toneSummary}`] : []),
    ...(referenceSnap?.url
      ? [
          "",
          `=== REFERENTIESITE (door gebruiker) ===`,
          `URL: ${referenceSnap.url} — het HTML-excerpt in de **hoofdopdracht** hierboven is leidend naast de briefing; dit contract moet daarmee **inhoudelijk samenhangen** (zelfde palet-/licht-donker-spoor en beeldtaal; geen 1-op-1 kopie van layout of vreemde lange teksten).`,
        ]
      : []),
  ];
  return lines.join("\n");
}

/** Rijkere context voor Unsplash-query-mix (`themeContext`). */
export function buildUnsplashThemeContextWithContract(
  description: string,
  contract: DesignGenerationContract | null | undefined,
): string {
  if (!contract) return description;
  const extra = [
    contract.heroVisualSubject,
    contract.heroImageSearchHints,
    ...contract.imageryMustReflect,
  ]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" · ");
  if (!extra.trim()) return description;
  return `${description}\n\n[Designcontract — visuele kern voor afbeeldingen: ${extra}]`;
}
