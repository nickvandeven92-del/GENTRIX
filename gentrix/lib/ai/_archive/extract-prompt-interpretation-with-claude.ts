import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import {
  normalizeInterpretationInput,
  type PromptInterpretation,
} from "@/lib/ai/prompt-interpretation-types";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Semantische interpretatielaag (primair i.t.t. keyword-heuristiek).
 * Zet `EXTRACT_PROMPT_INTERPRETATION_WITH_CLAUDE=1` in `.env.local`.
 */
export function isExtractPromptInterpretationWithClaudeEnabled(): boolean {
  const v = process.env.EXTRACT_PROMPT_INTERPRETATION_WITH_CLAUDE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const INTERPRETATION_JSON_INSTRUCTIONS = `Je bent een senior product strategist. Lees de briefing (elke taal, rommelige tekst mag) en reconstrueer ONDERLIGGENDE BETEKENIS — niet alleen keywords.

Antwoord met ALLEEN één JSON-object (geen markdown fences).

Exact deze keys en enum-waarden:

{
  "confidence": number 0..1  (hoe zeker ben je gezien de rijkdom van de briefing; kort/vage prompt => laag),
  "businessModel": "service" | "product" | "hybrid" | "content" | "portfolio",
  "primaryGoal": "lead_generation" | "sales" | "signup" | "branding",
  "audienceType": "consumer" | "business" | "mixed",
  "trustNeed": "low" | "medium" | "high",
  "proofNeed": "low" | "medium" | "high",
  "visualTone": "minimal" | "luxury" | "tech" | "industrial" | "editorial" | "playful" | "corporate",
  "visualEnergy": "calm" | "balanced" | "bold",
  "visualRestraint": "low" | "medium" | "high"  (hoeveel visuele rust / anti-druk),
  "contentDepth": "lean" | "medium" | "rich",
  "scanBehavior": "fast" | "balanced" | "exploratory",
  "emotionalTone": "practical" | "authoritative" | "friendly" | "aspirational" | "bold",
  "ctaUrgency": "low" | "medium" | "high",
  "uniquenessNeed": "low" | "medium" | "high"  (anti-template, opvallen),
  "industryHint": string | null  (korte branche in het Nederlands, of null)
}

Regels:
- "meer aanvragen/offertes/klanten" => primaryGoal lead_generation, vaak trustNeed/proofNeed medium-high.
- Webshop/verkopen => businessModel product, primaryGoal sales.
- SaaS/demo/trial => product + signup of lead_generation, visualTone tech.
- Magazine/blog => content, branding of lead_generation secundair, editorial/minimal.
- Expliciete stijl ("niet te druk", "premium en rustig") weegt zwaarder dan enkel een branchewoord.
- Vintage, retro, klassiek, "warm papier", old-school typografie, barbershop-heritage, serif-koppen, magazine-look => **visualTone editorial** (of **luxury** als expliciet high-end goud/chique); **niet** "minimal" tenzij de tekst echt minimalistisch/strak wil.
- **luxury** visualTone betekent **niet** automatisch donkere achtergronden — lichte editorial (ivoor, veel witruimte) is even geldig tenzij de tekst donker/noir/dark mode expliciet vraagt.
- Korte prompts: confidence bewust lager houden.`;

export async function extractPromptInterpretationWithClaude(
  userPrompt: string,
): Promise<{ ok: true; data: PromptInterpretation } | { ok: false; error: string }> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY ontbreekt." };
  }

  const trimmed = userPrompt?.trim() ?? "";
  if (!trimmed) {
    return { ok: false, error: "Lege prompt." };
  }

  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 2048),
      messages: [
        {
          role: "user",
          content: `${INTERPRETATION_JSON_INSTRUCTIONS}

BRIEFING:
${trimmed.slice(0, 14_000)}`,
        },
      ],
    });

    await logClaudeMessageUsage("extract_prompt_interpretation", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord." };
    }

    const parsed = parseModelJsonObject(textBlock.text);
    if (!parsed.ok) {
      return { ok: false, error: "Geen geldige JSON in antwoord." };
    }

    const validated = normalizeInterpretationInput(parsed.value);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    return { ok: true, data: validated.value };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extractPromptInterpretationWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
