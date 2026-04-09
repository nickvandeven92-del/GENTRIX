import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { ensureSiteIntentDesignRegime } from "@/lib/ai/above-fold-archetypes";
import { siteIntentSchema, type SiteIntent } from "@/lib/ai/site-experience-model";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Zet `EXTRACT_SITE_INTENT_WITH_CLAUDE=1` (of `true`) in `.env.local` voor een korte analyse-call
 * vóór site-generatie. Verbruikt tokens; bij fout/ontbrekende key valt `buildSiteConfig` terug op
 * dezelfde resolver als `resolveSiteIntentFromInterpretation` / `extractSiteIntentFromPrompt`.
 */
export function isExtractSiteIntentWithClaudeEnabled(): boolean {
  const v = process.env.EXTRACT_SITE_INTENT_WITH_CLAUDE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const INTENT_JSON_INSTRUCTIONS = `Je bent een senior website strategist. Lees de briefing en antwoord met ALLEEN één JSON-object (geen markdown fences, geen uitleg).

Exact deze keys en waarden (enum strings exact zo):

{
  "experienceModel": "saas_landing" | "service_leadgen" | "premium_product" | "ecommerce_home" | "search_first_catalog" | "editorial_content_hub" | "health_authority_content" | "hybrid_content_commerce" | "brand_storytelling" | "community_media",
  "designRegime": "hero_split" | "hero_integrated" | "hero_mixed" (optioneel; bij twijfel weglaten — server vult af),
  "navigationDepth": "minimal" | "standard" | "category_rich" | "portal",
  "densityProfile": "airy" | "balanced" | "dense_commerce",
  "conversionModel": "lead_capture" | "direct_purchase" | "content_discovery" | "search_discovery" | "membership_signup" | "hybrid",
  "searchImportance": "none" | "supporting" | "primary",
  "trustStyle": "subtle" | "retail" | "authority" | "social_proof_heavy",
  "contentStrategy": "low" | "medium" | "high",
  "businessModel": "korte beschrijving 5–15 woorden, Nederlands of de taal van de briefing",
  "recommendedHomepagePattern": ["sectie-label-1", "sectie-label-2", "..."] 
}

Regels:
- Ecommerce / webshop → meestal ecommerce_home, category_rich, dense_commerce, search supporting of primary.
- Blog / magazine / recepten → editorial_content_hub, search primary, authority.
- Lokale dienst / barbier / fysio → service_leadgen, lead_capture, social_proof_heavy.
- SaaS / software → saas_landing.
- Zet recommendedHomepagePattern logisch (5–12 strings).`;

export async function extractSiteIntentWithClaude(userPrompt: string): Promise<
  | { ok: true; data: SiteIntent }
  | { ok: false; error: string }
> {
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
      max_tokens: clampMaxTokensNonStreaming(model, 1536),
      messages: [
        {
          role: "user",
          content: `${INTENT_JSON_INSTRUCTIONS}

BRIEFING:
${trimmed.slice(0, 12_000)}`,
        },
      ],
    });

    await logClaudeMessageUsage("extract_site_intent", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord." };
    }

    const parsed = parseModelJsonObject(textBlock.text);
    if (!parsed.ok) {
      return { ok: false, error: "Geen geldige JSON in antwoord." };
    }

    const validated = siteIntentSchema.safeParse(parsed.value);
    if (!validated.success) {
      return { ok: false, error: validated.error.message };
    }

    return { ok: true, data: ensureSiteIntentDesignRegime(validated.data) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extractSiteIntentWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
