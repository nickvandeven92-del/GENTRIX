import { z } from "zod";

/**
 * Visuele assen afgeleid van de **referentiesite** (HTML-excerpt) — leidend op compositie & UI-schil,
 * naast de briefing (branche, inhoud, doelgroep, CTA).
 * Gebruik `unspecified` alleen als het excerpt dat echt niet ondersteunt (niet als luie default).
 */
export const referenceVisualAxesSchema = z.object({
  layoutRhythm: z.enum(["tight", "balanced", "airy", "editorial_mosaic", "unspecified"]),
  themeMode: z.enum(["light", "dark", "mixed", "unspecified"]),
  /** Kleur- en contrastintentie uit referentie (bv. "diep navy + teal accent, hoog contrast"). */
  paletteIntent: z.string().min(5).max(450),
  typographyDirection: z.enum([
    "sans_modern",
    "sans_humanist",
    "serif_editorial",
    "mixed_pairing",
    "mono_accent",
    "unspecified",
  ]),
  /** Vrije maar concrete beschrijving: bv. split 50/50, centered copy + full-bleed media, asymmetrische overlay. */
  heroComposition: z.string().min(8).max(500),
  sectionDensity: z.enum(["compact", "medium", "sparse", "unspecified"]),
  motionStyle: z.enum(["static_minimal", "scroll_reveal", "expressive", "marquee_forward", "unspecified"]),
  borderTreatment: z.enum(["none_minimal", "accent_lines", "border_reveal_forward", "frame_heavy", "unspecified"]),
  cardStyle: z.enum(["flat", "soft_shadow", "glass_blur", "bordered_tile", "unspecified"]),
});

export type ReferenceVisualAxes = z.infer<typeof referenceVisualAxesSchema>;

/** Één string voor prompts/Unsplash; model levert soms een lijst — samenvoegen i.p.v. contract te breken. */
function normalizeHeroImageSearchHints(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (Array.isArray(val)) {
    const joined = val
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0)
      .join("; ");
    if (!joined) return undefined;
    return joined.length > 500 ? joined.slice(0, 500) : joined;
  }
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return undefined;
    return t.length > 500 ? t.slice(0, 500) : t;
  }
  return undefined;
}

/**
 * Machine-leesbaar “designcontract” uit de Denklijn-fase: gaat de generator- en zelfreview-prompt in
 * zodat visuele keuzes (hero, palet, beeld, motion) aansluiten bij dezelfde run.
 */
export const designGenerationContractSchema = z.object({
  heroVisualSubject: z.string().min(5).max(800),
  heroImageSearchHints: z.preprocess(
    normalizeHeroImageSearchHints,
    z.string().max(500).optional(),
  ),
  paletteMode: z.enum(["light", "dark", "either"]),
  primaryPaletteNotes: z.string().max(400).optional(),
  imageryMustReflect: z.array(z.string().min(1)).min(1).max(12),
  imageryAvoid: z.array(z.string()).max(12).optional().default([]),
  motionLevel: z.enum(["none", "subtle", "moderate", "strong"]),
  toneSummary: z.string().max(500).optional(),
  /** Alleen vullen wanneer er een referentie-excerpt in de Denklijn-run zat; anders weglaten. */
  referenceVisualAxes: referenceVisualAxesSchema.optional(),
});

export type DesignGenerationContract = z.infer<typeof designGenerationContractSchema>;

/** JSON-envelop die het rationale-model één keer levert. */
export const designRationaleEnvelopeSchema = z.object({
  rationale_nl: z.string().min(60).max(14_000),
  contract: z.unknown(),
});

const AXIS_LABELS: Record<keyof ReferenceVisualAxes, string> = {
  layoutRhythm: "layoutRhythm (ritme / kolommen / witruimte)",
  themeMode: "themeMode (licht/donker/mixed)",
  paletteIntent: "paletteIntent (kleurintentie)",
  typographyDirection: "typographyDirection",
  heroComposition: "heroComposition",
  sectionDensity: "sectionDensity",
  motionStyle: "motionStyle",
  borderTreatment: "borderTreatment",
  cardStyle: "cardStyle",
};

/** Leesbare assen voor generator- of review-prompt. */
export function formatReferenceVisualAxesForPrompt(axes: ReferenceVisualAxes): string {
  const lines: string[] = [];
  (Object.keys(AXIS_LABELS) as (keyof ReferenceVisualAxes)[]).forEach((key) => {
    const v = axes[key];
    lines.push(`- **${AXIS_LABELS[key]}:** ${typeof v === "string" ? v : String(v)}`);
  });
  return lines.join("\n");
}

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

  const axes = contract.referenceVisualAxes;
  const axesBlock =
    axes != null
      ? [
          "",
          "=== ROLVERDELING (bindend) ===",
          "- **Briefing:** branche, inhoud, doelgroep, CTA’s, claims — die winnen op *inhoud* en *feitelijke copy*.",
          "- **referenceVisualAxes (hieronder):** visuele schil afgeleid van de **referentiesite** (ritme, thema, typografie-houding, hero-compositie, dichtheid, motion-, rand- en kaartstijl). Geen letterlijke overname van vreemde lange teksten of merknamen.",
          "- **Basisvelden** (`heroVisualSubject`, `imageryMustReflect`, `paletteMode`, `motionLevel`, …): sluit de **briefing/branche** aan. Bij conflict: **briefing** op inhoud/claims; **referenceVisualAxes** op layout/compositie/kleurritme/motion/randen/kaarten **tenzij** de briefing iets visueels expliciet verbiedt.",
          "",
          "=== REFERENCE VISUAL AXES (per as uitvoeren in HTML + `config`) ===",
          "Vertaal elke as naar concrete Tailwind-keuzes (spacing, max-width, grid/flex, `config.theme`, `config.font`, `data-animation`, `studio-border-reveal`, kaart-randen/schaduwen). `unspecified` = geen dwang op die as.",
          formatReferenceVisualAxesForPrompt(axes),
        ]
      : [];

  const lines = [
    "Je **moet** deze afspraken in `config` (thema/kleuren) en in de **hero** en overige beelden concreet maken — **tenzij** de briefing hier **expliciet** mee in strijd is (dan wint altijd de briefing).",
    "Als de briefing **webshop**, **online bestellen** of een **fysieke winkel** met producten in deze branche noemt, mag **breed** `imageryAvoid` (zoals “algemene retail”) **nooit** domineren boven sectorjuiste product-, winkel- of sportscènes — gebruik dan alleen scherpe, off-topic vermijdingen (bv. supermarkt, unrelated mall).",
    "",
    `- **Hero-visueel:** ${contract.heroVisualSubject}`,
    ...(contract.heroImageSearchHints
      ? [`- **Zoekhints voor hero/stock (sluit aan bij onderwerp):** ${contract.heroImageSearchHints}`]
      : []),
    `- **Palett:** ${paletteNl}${contract.primaryPaletteNotes ? ` Verder: ${contract.primaryPaletteNotes}` : ""}`,
    `- **Beeldthema (must):** ${must}`,
    `- **Vermijd als dominant beeld:** ${avoid}`,
    `- **Motion (contract.motionLevel):** ${motionNl}`,
    ...(contract.toneSummary ? [`- **Toon copy:** ${contract.toneSummary}`] : []),
    ...axesBlock,
    ...(referenceSnap?.url
      ? [
          "",
          "=== REFERENTIESITE-URL ===",
          `${referenceSnap.url} — HTML-excerpt staat in de hoofdopdracht; visuele output moet **structuur + stijl** uit dat excerpt volgen (geen woord-snippet-theater).${
            axes != null
              ? " `referenceVisualAxes` hierboven is de checklijst per design-aspect."
              : ""
          }`,
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
  const axes = contract.referenceVisualAxes;
  const extra = [
    contract.heroVisualSubject,
    contract.heroImageSearchHints,
    axes?.paletteIntent,
    axes?.heroComposition,
    ...contract.imageryMustReflect,
  ]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" · ");
  if (!extra.trim()) return description;
  return `${description}\n\n[Designcontract — visuele kern voor afbeeldingen: ${extra}]`;
}
