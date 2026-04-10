import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import type { ExtractedDesignFromImage } from "@/lib/ai/build-site-config";
import { designPersonalitySchema } from "@/lib/ai/design-personality";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const extractedSchema = z.object({
  layout: z.string(),
  spacing: z.string(),
  colors: z.array(z.string()),
  components: z.array(z.string()),
  style: z.string(),
  personality: designPersonalitySchema.optional(),
});

export type ExtractDesignFromImageResult =
  | { ok: true; data: ExtractedDesignFromImage }
  | { ok: false; error: string };

export function findFirstKnowledgeImageUrl(blocks: ContentBlockParam[]): string | undefined {
  for (const b of blocks) {
    if (b.type === "image" && b.source.type === "url") {
      return b.source.url;
    }
  }
  return undefined;
}

/**
 * Eén vision-call: leest een referentiescreenshot en vat stijl/structuur samen als JSON.
 * Te mergen met {@link mergeExtractedDesignIntoSiteConfig}.
 */
export async function extractDesignFromImage(imageUrl: string): Promise<ExtractDesignFromImageResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return { ok: false, error: `ANTHROPIC_API_KEY ontbreekt. ${ANTHROPIC_KEY_MISSING_USER_HINT}` };
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const userContent: ContentBlockParam[] = [
    {
      type: "text",
      text: `Analyseer dit website- of UI-screenshot (high-end referentie). Antwoord met **alleen** één JSON-object, geen markdown fences, geen extra tekst.

Vorm (exact deze keys; personality optioneel):
{
  "layout": "korte beschrijving, bv. split hero, centered, bento grid",
  "spacing": "compact | balanced | spacious",
  "colors": ["dominante kleurtermen, bv. light editorial, navy accent, warm neutrals"],
  "components": ["hero", "features", "cta", ...] — welke blokken herken je ongeveer,
  "style": "één label, bv. modern_saas, luxury_minimal, neubrutalist",
  "personality": "optioneel, één van: bold_industrial | elegant_luxury | playful_creative | minimal_tech | editorial_art | trust_conversion"
}`,
    },
    { type: "image", source: { type: "url", url: imageUrl } },
  ];

  try {
    const message = await client.messages.create({
      model,
      max_tokens: clampMaxTokensNonStreaming(model, 1024),
      messages: [{ role: "user", content: userContent }],
    });

    await logClaudeMessageUsage("extract_design_image", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord van Claude." };
    }

    const parsed = parseModelJsonObject(textBlock.text);
    if (!parsed.ok) {
      return { ok: false, error: "Antwoord is geen geldige JSON." };
    }

    const validated = extractedSchema.safeParse(parsed.value);
    if (!validated.success) {
      return { ok: false, error: validated.error.message };
    }

    return { ok: true, data: validated.data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extractDesignFromImage mislukt.";
    return { ok: false, error: msg };
  }
}
