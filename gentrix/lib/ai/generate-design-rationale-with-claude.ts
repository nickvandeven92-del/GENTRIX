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

=== OUTPUT (strikt) ===
- Antwoord met **alleen** één geldig JSON-object (geen markdown buiten JSON, geen uitleg erna).
- Top-level keys, precies:
  1. \`rationale_nl\` — **4 tot 6 korte alinea's** in het Nederlands (elk 1–3 zinnen), geschikt om aan een klant te tonen. Geen \`#\`-koppen in de string. Leg uit hoe de **briefing** gelezen wordt en welke richting de site krijgt.
  2. \`contract\` — object volgens het schema hieronder. Vul het **concreet** op basis van de briefing; geen vage placeholders. Als de briefing kort is: kies redelijke defaults die bij de branche passen, maar zet dat ook in \`rationale_nl\` (onzekerheid benoemen).

=== INHOUD rationale_nl (volgorde) ===
1. Branche & sfeer — welk beeld lees je uit de tekst?
2. Design — visuele richting; **luxe is geen reden om automatisch donker te kiezen**; noem lichte én donkere opties als \`paletteMode\` \`either\` is.
3. Pagina — sectievolgorde uit de interpretatie; hero als eerste gezicht (wat moet er visueel gebeuren).
4. **Referentiesite:** Als het user-bericht een blok **REFERENTIESITE** met HTML-excerpt bevat, is dat **leidend naast de briefing** voor sfeer (palet licht/donker, typografie-ritme, beeldtaal, motion-dichtheid). Leg in \`rationale_nl\` kort uit **welke** sfeer je uit het excerpt haalt. Als de interpretatie-JSON alleen \`referenceStyle.status: "failed"\` toont (geen excerpt): meld kort dat ophalen mislukte en werk **zonder** referentie-verplichting.
5. Fine-tunen — één concrete tip om de briefing te verbeteren.

=== contract schema (velden) ===
- \`heroVisualSubject\` (string): één zin: wat moet de hero **visueel** uitbeelden (concreet, geen buzzwords).
- \`heroImageSearchHints\` (string, optioneel): 3–12 korte EN/NL zoektermen voor stock (komma-gescheiden), passend bij de branche.
- \`paletteMode\`: \`"light"\` | \`"dark"\` | \`"either"\` — kies \`either\` alleen als de briefing echt beide toe laat.
- \`primaryPaletteNotes\` (string, optioneel): bv. "diep blauw + teal accent".
- \`imageryMustReflect\` (array van strings, minstens 1): onderwerpen die **alle** prominente foto's moeten ondersteunen (bv. "hengelsport", "water", "visuitrusting").
- \`imageryAvoid\` (array, optioneel): dingen die **niet** als hoofdbeeld mogen (bv. "generiek kantoor", "random plant/natuur zonder link naar de branche").
- \`motionLevel\`: \`"none"\` | \`"subtle"\` | \`"moderate"\` | \`"strong"\` — sluit aan bij de briefing (dynamisch/interactief/scroll ⇒ minstens \`moderate\` als de briefing dat vraagt).
- \`toneSummary\` (string, optioneel): toon van de copy in één zin.

**Met REFERENTIESITE-excerpt in het user-bericht:** \`paletteMode\`, \`primaryPaletteNotes\`, \`heroVisualSubject\`, \`heroImageSearchHints\`, \`motionLevel\`, \`imageryMustReflect\` en \`imageryAvoid\` moeten **duidelijk** uit het excerpt volgen (geen pixel-perfecte kopie; wel dezelfde visuele familie). Bij twijfel tussen briefing en referentie wint de **briefing** — maar negeer een geslaagde referentie niet zonder reden in \`rationale_nl\`.

Het \`contract\` wordt **letterlijk** aan de generator gekoppeld: wees daarom **consequent** met \`rationale_nl\` (zelfde verhaal, contract = harde afspraken).`;

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

**Opdracht:** Lees dit excerpt en stel \`rationale_nl\` + \`contract\` daar **duidelijk** op af voor een eigen one-pager voor "${businessName}" (zelfde visuele familie: kleur, licht/donker, typografie-ritme, beeld-onderwerp, motion-niveau).`;
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

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 2_048),
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

    return {
      ok: true,
      text: envelope.data.rationale_nl.trim(),
      contract: contractParsed.data,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generateDesignRationaleWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
