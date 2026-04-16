import Anthropic from "@anthropic-ai/sdk";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import {
  designGenerationContractSchema,
  designRationaleEnvelopeSchema,
  type DesignGenerationContract,
} from "@/lib/ai/design-generation-contract";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";

const SYSTEM = `Je bent een senior product- en merkstrateeg én je vult een **bindend designcontract** voor de website-generator in dezelfde run.

=== ROLVERDELING (leidend — niet wollig) ===
- **Briefing** bepaalt: branche, inhoud, doelgroep, CTA’s, verboden claims, toon van copy (feitelijk kader).
- **Referentiesite (HTML-excerpt in user-bericht)** bepaalt: **visuele schil** — layoutritme, licht/donker, kleurintentie, typografie-houding, hero-**compositie**, sectiedichtheid, motion-**karakter**, rand/kader-behandeling, kaartstijl. **Niet** vreemde lange teksten of merknamen letterlijk overnemen.
- **contract** legt vast **hoe** briefing + (eventuele) referentie samenkomen. Daarvoor gebruik je **twee lagen**:
  1. Basisvelden: \`heroVisualSubject\`, \`imageryMustReflect\`, \`paletteMode\`, \`motionLevel\`, enz. — primair briefing/branche.
  2. \`referenceVisualAxes\` — **alleen** als het user-bericht een blok **REFERENTIESITE** met excerpt bevat: **verplicht** object met **alle negen** sleutels. Per as een **concrete** keuze uit de toegestane enums of vrije string; gebruik \`unspecified\` **alleen** als het excerpt die as echt niet draagt — noem in \`rationale_nl\` kort welke assen uit het excerpt komen en welke \`unspecified\` zijn en waarom.

=== OUTPUT (strikt) ===
- Antwoord met **alleen** één geldig JSON-object (geen markdown buiten JSON, geen uitleg erna).
- Top-level keys, precies:
  1. \`rationale_nl\` — **4 tot 6 korte alinea's** in het Nederlands (elk 1–3 zinnen). Leg uit: briefing-lezing, eventuele referentie-assen (per as, geen vaag “we namen het mee”), en hoe contract de twee merged.
  2. \`contract\` — object volgens het schema hieronder.

=== INHOUD rationale_nl (volgorde) ===
1. Branche & sfeer uit briefing.
2. Designrichting uit briefing + basisvelden contract.
3. Pagina / sectievolgorde; hero-eis op hoofdlijn.
4. **Referentie:** alleen als excerpt aanwezig: welke **visuele** conclusies per as (\`layoutRhythm\`, \`themeMode\`, …); geen loze bevestiging. Als \`referenceStyle.status: "failed"\` in JSON: kort melden, geen assen afdwingen.
5. Fine-tunen — één concrete tip voor de briefing.

=== contract — basisvelden ===
- \`heroVisualSubject\`, \`paletteMode\`, \`primaryPaletteNotes\` (optioneel), \`motionLevel\`, \`toneSummary\` (optioneel).
- \`paletteMode\` — **exact één** van: \`"light"\` | \`"dark"\` | \`"either"\` (hoofdthema van de site). **Niet** \`"mixed"\` (dat hoort bij \`referenceVisualAxes.themeMode\` bij referentie). Warm/helder → \`"light"\`; diep/neon → \`"dark"\`; echt licht-of-donker vrij → \`"either"\`.
- \`motionLevel\` — **exact één** van deze strings (geen synoniemen zoals "high"): \`"none"\` | \`"subtle"\` | \`"moderate"\` | \`"strong"\`. Hoge bewegingswens uit briefing → meestal \`"strong"\`; spaarzaam → \`"subtle"\`.
- \`heroImageSearchHints\` (optioneel) — **één string** met komma’s of puntkomma’s (geen JSON-array), of een string-array die server-side wordt samengevoegd.
- \`imageryMustReflect\` — **JSON-array** van 1–12 korte strings (bv. \`["sector","lifestyle"]\`). Liever **geen** enkele doorlopende CSV-string; als je toch één string gebruikt: splits met komma’s of puntkomma’s (max. 12 onderdelen).
- \`imageryAvoid\` (optioneel) — **JSON-array** van max. 12 strings (zelfde stijl als \`imageryMustReflect\`), of leeg weglaten.
- \`motionLevel\` moet **samenhangen** met \`referenceVisualAxes.motionStyle\` wanneer assen aanwezig zijn (geen tegenstrijdig extreme pair zonder uitleg in rationale_nl).
- **imageryAvoid vs. winkel/webshop:** als de briefing een **fysieke winkel**, **webshop**, **online bestellen** of duidelijke **productverkoop** in deze sector noemt, zet dan **geen** brede vermijdingen als "retail", "winkelsfeer" of "winkelomgeving" — dat laat de generator ten onrechte generieke natuur- of hobbyfoto’s kiezen i.p.v. sectorjuiste uitrusting, water/visserij of een nette specialistische winkelsetting. Vermijd alleen **niet passende** retail (supermarkt, winkelcentrum zonder sectorlink, kantoor-stock) en expliciet off-topic beelden.

=== contract — referenceVisualAxes (verplicht bij REFERENTIESITE-excerpt) ===
Object met exact deze keys (enum-waarden exact zoals hieronder):

- \`layoutRhythm\`: \`"tight"\` | \`"balanced"\` | \`"airy"\` | \`"editorial_mosaic"\` | \`"unspecified"\`
- \`themeMode\`: \`"light"\` | \`"dark"\` | \`"mixed"\` | \`"unspecified"\`
- \`paletteIntent\`: string (5–450 tekens) — concrete kleur/contrastintentie uit referentie (bv. "navy achtergrond, teal accent, koel wit tekstvlak").
- \`typographyDirection\`: \`"sans_modern"\` | \`"sans_humanist"\` | \`"serif_editorial"\` | \`"mixed_pairing"\` | \`"mono_accent"\` | \`"unspecified"\`
- \`heroComposition\`: string (8–500 tekens) — compositie **principe** (split, centered + media, overlay, asymmetrisch …), geen pixel-maten uit excerpt kopiëren.
- \`sectionDensity\`: \`"compact"\` | \`"medium"\` | \`"sparse"\` | \`"unspecified"\`
- \`motionStyle\`: \`"static_minimal"\` | \`"scroll_reveal"\` | \`"expressive"\` | \`"unspecified"\` — **geen** tickers/marquee; gebruik **niet** \`"marquee_forward"\` (legacy wordt server-side naar \`scroll_reveal\` gemapt).
- \`borderTreatment\`: \`"none_minimal"\` | \`"accent_lines"\` | \`"border_reveal_forward"\` | \`"frame_heavy"\` | \`"unspecified"\`
- \`cardStyle\`: \`"flat"\` | \`"soft_shadow"\` | \`"glass_blur"\` | \`"bordered_tile"\` | \`"unspecified"\`

**Zonder** REFERENTIESITE-excerpt in het user-bericht: laat \`referenceVisualAxes\` volledig weg (geen leeg object, geen null).

Het \`contract\` wordt **letterlijk** aan de generator gekoppeld — geen rhetorische “we hebben de referentie meegenomen” zonder dat de assen het excerpt echt vertalen.`;

/** Standaard aan. Zet \`SKIP_DESIGN_RATIONALE=1\` om een extra API-ronde te vermijden. */
export function isDesignRationaleDuringGenerationEnabled(): boolean {
  const v = process.env.SKIP_DESIGN_RATIONALE?.trim().toLowerCase();
  return v !== "1" && v !== "true" && v !== "yes";
}

export type GenerateDesignRationaleOutcome =
  | { ok: true; text: string; contract: DesignGenerationContract }
  | { ok: true; text: string; contract: null; contractWarning: string }
  | { ok: false; error: string };

function slimFeedbackForRationale(f: GenerationPipelineFeedback): Record<string, unknown> {
  const base: Record<string, unknown> = {
    businessName: f.interpreted.businessName,
    description: f.interpreted.description,
    sections: f.interpreted.sections,
  };
  if (f.interpreted.referenceStyle) {
    base.referenceStyle = f.interpreted.referenceStyle;
  }
  return base;
}

const REFERENCE_EXCERPT_MAX_CHARS = 14_000;

function buildReferenceSiteBlockForRationale(
  snap: { url: string; excerpt: string } | undefined,
  businessName: string,
): string {
  if (!snap?.excerpt?.trim()) return "";
  const excerpt = snap.excerpt.trim().slice(0, REFERENCE_EXCERPT_MAX_CHARS);
  return `

--- REFERENTIESITE (door server opgehaald — zelfde bron als in de bouw-prompt) ---
URL: ${snap.url}

HTML-fragment (stijl- en structuurhint; geen lange teksten of merknamen letterlijk kopiëren in contract-strings):
${excerpt}

**Opdracht:** Lees dit excerpt. Vul **referenceVisualAxes** (alle negen sleutels) met **concrete** waarden die het excerpt visueel vertalen (ritme, thema, paletintentie, typografie, hero-compositie, dichtheid, motion-stijl, randen, kaarten). Vul \`rationale_nl\` + overige contractvelden zodat briefing (inhoud/CTA) en referentie (visuele schil) **samenhangen** voor een eigen one-pager voor "${businessName}".`;
}

export async function generateDesignRationaleWithClaude(
  client: Anthropic,
  model: string,
  input: {
    businessName: string;
    description: string;
    feedback: GenerationPipelineFeedback;
    /** Alleen bij geslaagde fetch — zelfde excerpt als site-generatie. */
    referenceSiteSnapshot?: { url: string; excerpt: string };
  },
): Promise<GenerateDesignRationaleOutcome> {
  if (!isDesignRationaleDuringGenerationEnabled()) {
    return { ok: false, error: "overgeslagen (SKIP_DESIGN_RATIONALE)" };
  }

  const name = input.businessName.trim().slice(0, 200);
  const desc = input.description.trim().slice(0, 8_000);
  const ctx = slimFeedbackForRationale(input.feedback);
  const referenceBlock = buildReferenceSiteBlockForRationale(input.referenceSiteSnapshot, name || "de klant");
  const requiresReferenceAxes = Boolean(input.referenceSiteSnapshot?.excerpt?.trim());

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 2_560),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Bedrijfsnaam: ${name || "(niet opgegeven)"}

Briefing:
${desc || "(leeg)"}
${referenceBlock}
--- Interpretatie die de generator al vastlegde (JSON) ---
${JSON.stringify(ctx, null, 2)}

Schrijf nu het JSON-antwoord met rationale_nl + contract.`,
        },
      ],
    });

    await logClaudeMessageUsage("generate_site_design_rationale", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord." };
    }

    const raw = textBlock.text.trim();
    if (!raw) {
      return { ok: false, error: "Leeg antwoord." };
    }

    const parsedJson = parseModelJsonObject(raw);
    if (!parsedJson.ok) {
      return { ok: false, error: "Denklijn is geen parseerbare JSON (controleer model-output)." };
    }

    const envelope = designRationaleEnvelopeSchema.safeParse(parsedJson.value);
    if (!envelope.success) {
      return { ok: false, error: `Denklijn-envelop ongeldig: ${envelope.error.message}` };
    }

    const contractParsed = designGenerationContractSchema.safeParse(envelope.data.contract);
    if (!contractParsed.success) {
      return {
        ok: true,
        text: envelope.data.rationale_nl.trim(),
        contract: null,
        contractWarning: `Contract ongeldig (${contractParsed.error.message}) — generatie zonder designcontract.`,
      };
    }

    const contract = contractParsed.data;
    if (requiresReferenceAxes && contract.referenceVisualAxes == null) {
      return {
        ok: true,
        text: envelope.data.rationale_nl.trim(),
        contract: null,
        contractWarning:
          "Referentie-excerpt aanwezig maar `referenceVisualAxes` ontbreekt in contract — generatie zonder designcontract (herhaal run of strakker model).",
      };
    }

    if (!requiresReferenceAxes && contract.referenceVisualAxes != null) {
      return {
        ok: true,
        text: envelope.data.rationale_nl.trim(),
        contract: null,
        contractWarning:
          "`referenceVisualAxes` meegegeven zonder referentie-excerpt — generatie zonder designcontract.",
      };
    }

    return {
      ok: true,
      text: envelope.data.rationale_nl.trim(),
      contract,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generateDesignRationaleWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
