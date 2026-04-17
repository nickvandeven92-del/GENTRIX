import { z } from "zod";
import { SITE_SIGNATURE_ARCHETYPE_LABELS, siteSignatureSchema } from "@/lib/ai/site-signature-schema";

/**
 * Visuele assen afgeleid van de **referentiesite** (HTML-excerpt) — leidend op compositie & UI-schil,
 * naast de briefing (branche, inhoud, doelgroep, CTA).
 * Gebruik `unspecified` alleen als het excerpt dat echt niet ondersteunt (niet als luie default).
 */
const motionStyleFieldSchema = z
  .union([
    z.enum(["static_minimal", "scroll_reveal", "expressive", "unspecified"]),
    /** Legacy uit oudere rationale-contracten; wordt genormaliseerd naar `scroll_reveal`. */
    z.literal("marquee_forward"),
  ])
  .transform((v) => (v === "marquee_forward" ? "scroll_reveal" : v));

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
  motionStyle: motionStyleFieldSchema,
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

const IMAGERY_LIST_MAX = 12;

const MOTION_LEVEL_ENUM = ["none", "subtle", "moderate", "strong"] as const;

const PALETTE_MODE_ENUM = ["light", "dark", "either"] as const;

/**
 * `paletteMode` is alleen \`light\` | \`dark\` | \`either\` (hoofdthema); modellen zetten soms \`mixed\`, kleurwoorden of NL.
 */
function normalizePaletteMode(val: unknown): unknown {
  if (val == null) return val;
  const raw = String(val).trim().toLowerCase();
  if (!raw) return val;
  const s = raw.replace(/\s+/g, " ");
  if ((PALETTE_MODE_ENUM as readonly string[]).includes(s)) return s;

  const typoFix: Record<string, (typeof PALETTE_MODE_ENUM)[number]> = {
    ligth: "light",
    ligjt: "light",
    drak: "dark",
    darl: "dark",
    dorl: "dark",
  };
  if (typoFix[s]) return typoFix[s];

  const toEither = new Set([
    "mixed",
    "flexible",
    "auto",
    "any",
    "neutral",
    "balanced",
    "adaptable",
    "versatile",
    "colorful",
    "vibrant",
    "licht of donker",
    "light or dark",
    "dual",
    "both",
  ]);
  if (toEither.has(s)) return "either";

  const toLight = new Set([
    "bright",
    "warm",
    "pastel",
    "airy",
    "cream",
    "daylight",
    "day",
    "white",
    "high-key",
    "highkey",
    "luminant",
    "licht",
    "light mode",
    "warm light",
    "soft light",
    "off-white",
    "offwhite",
  ]);
  if (toLight.has(s)) return "light";

  const toDark = new Set([
    "night",
    "moody",
    "neon",
    "deep",
    "bold",
    "black",
    "low-key",
    "lowkey",
    "dramatic",
    "noir",
    "donker",
    "dark mode",
    "dim",
  ]);
  if (toDark.has(s)) return "dark";

  return val;
}

/**
 * LLM’s gebruiken soms natuurlijke synoniemen (“high”, “medium”) i.p.v. de vaste enum.
 * Mappen naar canonieke waarden zodat het designcontract niet ongeldig wordt.
 */
function normalizeMotionLevel(val: unknown): unknown {
  if (val == null) return val;
  const s = String(val).trim().toLowerCase();
  if (!s) return val;
  if ((MOTION_LEVEL_ENUM as readonly string[]).includes(s)) return s;
  if (["high", "higher", "heavy", "intense", "expressive", "maximum", "max"].includes(s)) {
    return "strong";
  }
  if (["low", "light", "little", "minimal"].includes(s)) {
    return "subtle";
  }
  if (["medium", "mid", "average"].includes(s)) {
    return "moderate";
  }
  if (["off", "zero", "disabled"].includes(s)) {
    return "none";
  }
  return val;
}

/**
 * Model + legacy payloads leveren soms één CSV-string i.p.v. JSON-array (prompt noemde eerder “zoals hints”).
 * Splitsen op komma/puntkomma/pipe/regeleinde; trimmen; max. IMAGERY_LIST_MAX items.
 */
function splitImageryPhraseList(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "number" || typeof val === "boolean") {
    return splitImageryPhraseList(String(val));
  }
  if (Array.isArray(val)) {
    return val
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0)
      .slice(0, IMAGERY_LIST_MAX);
  }
  if (typeof val === "string") {
    return val
      .split(/[,;|\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, IMAGERY_LIST_MAX);
  }
  return [];
}

/** `z.preprocess` + inner `z.array` geeft in Zod 4 soms dubbele fouten (string vs array + verkeerde max). */
const imageryMustReflectFieldSchema = z
  .unknown()
  .transform((val) => splitImageryPhraseList(val))
  .pipe(z.array(z.string().min(1)).min(1).max(IMAGERY_LIST_MAX));

const imageryAvoidFieldSchema = z
  .unknown()
  .optional()
  .transform((val) => splitImageryPhraseList(val))
  .pipe(z.array(z.string()).max(IMAGERY_LIST_MAX));

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
  paletteMode: z.preprocess(normalizePaletteMode, z.enum(PALETTE_MODE_ENUM)),
  primaryPaletteNotes: z.string().max(400).optional(),
  imageryMustReflect: imageryMustReflectFieldSchema,
  imageryAvoid: imageryAvoidFieldSchema,
  motionLevel: z.preprocess(normalizeMotionLevel, z.enum(MOTION_LEVEL_ENUM)),
  toneSummary: z.string().max(500).optional(),
  /** Alleen vullen wanneer er een referentie-excerpt in de Denklijn-run zat; anders weglaten. */
  referenceVisualAxes: referenceVisualAxesSchema.optional(),
  /**
   * Site-signatuur: één compositie-lijn + meetbare anti-templates (Denklijn levert dit bij nieuwe runs).
   * Optioneel voor **legacy** opgeslagen contracten zonder dit veld.
   */
  siteSignature: siteSignatureSchema.optional(),
});

export type DesignGenerationContract = z.infer<typeof designGenerationContractSchema>;

export type { SiteSignature } from "@/lib/ai/site-signature-schema";
export { SITE_SIGNATURE_ARCHETYPE_LABELS } from "@/lib/ai/site-signature-schema";

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
          ? "Merkbare maar nette motion (meerdere `data-animation`, border-reveal waar de briefing dat ondersteunt; geen scrollende tickers)."
          : "Sterke motion passend bij de briefing (ruim `data-animation`, border-reveal; geen scrollende tickers of logo-banden).";

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
    "=== CONTRACT → HTML (geen lege belofte in copy — wél uitvoeren) ===",
    "Dit contract is **bindend gedrag** voor deze ene JSON-response: `config.theme` en dominante achtergronden moeten `paletteMode` en (indien gezet) `referenceVisualAxes.paletteIntent` **zichtbaar** volgen; sectieritme, kaartstijl, randbehandeling en hero-compositie moeten de assen **concreet** vertalen (Tailwind + `data-animation`/`studio-border-reveal` waar contract en briefing dat vragen).",
    "",
    ...(contract.siteSignature
      ? (() => {
          const sig = contract.siteSignature;
          const label = SITE_SIGNATURE_ARCHETYPE_LABELS[sig.archetype];
          const anti = sig.anti_templates_nl.join(" · ");
          return [
            "=== SITE-SIGNATURE (Denklijn — bindend) ===",
            `- **Archetype:** \`${sig.archetype}\` — ${label}`,
            `- **Commitment:** ${sig.commitment_nl}`,
            `- **Anti-templates (niet als default-patroon tenzij de briefing expliciet om dat patroon vraagt):** ${anti}`,
            "",
            "**Uitvoering:** `config.style` bevat **minstens één zin** die deze signature expliciet noemt (eigen woorden, geen copy-paste van dit blok). De **hero** en **minstens één vervolgsectie** laten zien dat je dit archetype meent (layout, ritme, typografie of beeld — niet alleen tekst).",
            "**Later (zelfreview):** verzwak deze signature niet naar generieke SaaS-stijl tenzij dat een **harde validator-fout**, **claim-conflict** of **expliciete briefing-tegenstrijd** oplost.",
            "",
          ];
        })()
      : [
            "=== SITE-SIGNATURE ===",
            "(Geen `siteSignature` in dit contract — kies in `config.style` alsnog **één** duidelijke compositie-lijn + vermijd generieke 3×2 marketing-defaults tenzij de briefing dat expliciet vraagt.)",
            "",
          ]),
    "=== BEELDEN (harde sector-eis) ===",
    "- Elke `https://images.unsplash.com/...` in `sections[].html` moet **inhoudelijk** passen bij `imageryMustReflect`, eventuele `heroImageSearchHints`, en de briefing-branche. **Verboden** als dominant beeld: off-topic stock (bv. kantoorinterieur, plantenmacro’s, kerken, scuba onderwater, abstracte code/matrix-walls, generieke stad zonder link naar de sector) tenzij dat letterlijk in `imageryMustReflect` of de briefing staat.",
    "- **Hero:** minstens één sterk visueel dat `heroVisualSubject` en de sector weerspiegelt (Unsplash met **passende** `photo-` id, split-layout met sectorfoto, of — **alleen** als de briefing een **concrete https-video-URL** bevat — `<video>` met exact die bron). Geen stock-video zonder URL in de briefing. Een **kale** effen kleurvlak-hero zonder sectoranker is **niet** voldoende als dit contract spanning/attractiepark/expressieve hero beschrijft.",
    "",
    "**ZELFCONTROLE vóór je JSON sluit:** (1) Imaginaire scroll: voelt elke sectie nog als **dezelfde branche** als de briefing? (2) Loop alle `<img`-URL’s: elk beeld moet aansluiten op minstens één term uit `imageryMustReflect` of `heroImageSearchHints`; zo niet → URL vervangen of sectie met gradient + sterke typografie. (3) `config` + `hero` + één feature-blok moeten `referenceVisualAxes` en `paletteMode` niet tegenspreken.",
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
  businessName?: string | null,
): string {
  const bn = businessName?.trim();
  const desc = description.trim();
  const head = bn ? `${bn}. ${desc}` : desc;
  if (!contract) return head;
  const axes = contract.referenceVisualAxes;
  const extra = [
    contract.heroVisualSubject,
    contract.heroImageSearchHints,
    axes?.paletteIntent,
    axes?.heroComposition,
    contract.siteSignature
      ? `Signature ${contract.siteSignature.archetype}: ${contract.siteSignature.commitment_nl}`
      : "",
    ...contract.imageryMustReflect,
  ]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" · ");
  if (!extra.trim()) return head;
  return `${head}\n\n[Designcontract — visuele kern voor afbeeldingen: ${extra}]`;
}
