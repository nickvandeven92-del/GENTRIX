import Anthropic from "@anthropic-ai/sdk";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import type { GenerationPipelineFeedback } from "@/lib/ai/generate-site-with-claude";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";

const SYSTEM = `Je bent een senior product- en merkstrateeg. Je legt in helder Nederlands uit hoe de **website-generator** de briefing heeft gelezen — alsof je een collega kort toespraakt vóór het bouwen.

Schrijf **4 tot 6 korte alinea's** (elk 1–3 zinnen), geen koppen met #, geen JSON, geen opsommingstekens tenzij max. één mini-lijst onderaan.

Behandel in volgorde:
1. **Branche & sfeer** — welk beeld (bijv. transport → beweging, betrouwbaarheid, kracht) lees je uit de tekst?
2. **Designkeuzes** — welke visuele richting (kleuren, stijl, toon) zou goed bij deze branche passen en waarom?
3. **Pagina-opbouw** — waarom deze **sectievolgorde** (bv. vertrouwen → diensten → CTA)? Noem kort dat de **hero het eerste gezicht** is en wat je daarvoor zou sturen (beeld, toon, belofte). Als \`referenceStyle\` in de JSON staat: noem kort of de referentiesite-URL is ingelezen of mislukt en wat dat voor de stijl betekent.
4. **Fine-tunen** — één concrete tip: welk woord of welke zin in de briefing zou je toevoegen of aanpassen om de richting te verschuiven (kleur, toon, meer B2B, **sterkere hero** …)?

Als de briefing erg kort is, zeg dat expliciet en noem wat onzeker blijft.`;

/** Standaard aan. Zet \`SKIP_DESIGN_RATIONALE=1\` om een extra API-ronde te vermijden. */
export function isDesignRationaleDuringGenerationEnabled(): boolean {
  const v = process.env.SKIP_DESIGN_RATIONALE?.trim().toLowerCase();
  return v !== "1" && v !== "true" && v !== "yes";
}

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

export async function generateDesignRationaleWithClaude(
  client: Anthropic,
  model: string,
  input: {
    businessName: string;
    description: string;
    feedback: GenerationPipelineFeedback;
  },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!isDesignRationaleDuringGenerationEnabled()) {
    return { ok: false, error: "overgeslagen (SKIP_DESIGN_RATIONALE)" };
  }

  const name = input.businessName.trim().slice(0, 200);
  const desc = input.description.trim().slice(0, 8_000);
  const ctx = slimFeedbackForRationale(input.feedback);

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 900),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Bedrijfsnaam: ${name || "(niet opgegeven)"}

Briefing:
${desc || "(leeg)"}

--- Interpretatie die de generator al vastlegde (JSON) ---
${JSON.stringify(ctx, null, 2)}

Schrijf nu de uitleg voor de gebruiker.`,
        },
      ],
    });

    await logClaudeMessageUsage("generate_site_design_rationale", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord." };
    }

    const text = textBlock.text.trim();
    if (!text) {
      return { ok: false, error: "Leeg antwoord." };
    }

    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generateDesignRationaleWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
