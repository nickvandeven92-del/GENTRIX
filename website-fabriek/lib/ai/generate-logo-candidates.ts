import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
type PresetId = string;
import { logoCandidatesResponseSchema, type BrandIdentity, type LogoSpec } from "@/types/logo";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const LOGO_JSON_INSTRUCTIONS = `Je bent een senior brand designer. Je output is ALLEEN één JSON-object (geen markdown, geen code fences, geen tekst erna).

Het object heeft exact deze vorm:
{
  "candidates": [ LogoSpec, LogoSpec, LogoSpec ]
}

LogoSpec (alle drie dezelfde structuur):
- "id": korte slug, uniek, bijv. "a-wordmark", "b-monogram", "c-combination"
- "layout": "horizontal" | "stacked" | "icon-only"
- "style": "wordmark" | "monogram" | "combination"
- "wordmark": {
    "text": string (merknaam of korte variant, max ~40 tekens voor leesbaarheid),
    "fontStyle": korte beschrijving voor CSS-achtige stack (bijv. "neo-grotesk clean", "high-contrast serif"),
    "letterSpacing": CSS-waarde string (bijv. "-0.02em", "0.18em", "0.05em"),
    "weight": geheel getal 400–800,
    "case": "upper" | "lower" | "title"
  }
- "symbol": {
    "type": "monogram" | "abstract" | "geometric" | "none",
    "concept": 1 zin wat de vorm doet (geen pad-data, geen SVG),
    "geometryHints": array van 1–4 korte tags uit:
      "corner-cut", "soft-round", "vertical-bar", "split-plane", "dot-grid", "single-stroke-rect", "rounded-monogram", "stacked-blocks"
  }
- "palette": {
    "primary": "#RRGGBB",
    "secondary": optioneel "#RRGGBB",
    "monoDark": "#RRGGBB (bijna zwart)",
    "monoLight": "#RRGGBB (bijna wit)"
  }

HARDE EIS: lever precies **drie** candidates met styles **wordmark**, **monogram**, en **combination** (elk exact één keer).

VERBODEN concepten (niet in concept-tekst of geometryHints impliciet gebruiken): raketten, wereldbollen, gloeilampen, praatwolkjes, swooshes, 3D, glans, clipart, overdreven detail, cartoon-mascottes.

REGELS:
- Alles moet in zwart-wit sterk leesbaar blijven (kleur is secundair).
- Favicon-gedachte: monogram/combination gebruiken simpele, dichte vormen; geen hairlines.
- Woordmerk: intentioneel, modern, ingetogen — liever minder decoratie.
- palette.primary moet aansluiten bij het meegegeven theme (primary/accent hex); kleine afwijking mag voor contrast.

Je krijgt JSON met brandIdentity — volg tone, typographyDirection, symbolDirection, colorMode en respecteer "avoid".`;

export async function generateLogoCandidatesWithClaude(input: {
  brand: BrandIdentity;
  presetId: PresetId;
  themePrimary: string;
  themeAccent: string;
}): Promise<{ ok: true; candidates: LogoSpec[] } | { ok: false; error: string }> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return { ok: false, error: "ANTHROPIC_API_KEY ontbreekt." };
  }

  const model = process.env.ANTHROPIC_LOGO_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });
  const max_tokens = clampMaxTokensNonStreaming(model, 4096);

  const payload = {
    presetId: input.presetId,
    themePrimary: input.themePrimary,
    themeAccent: input.themeAccent,
    brandIdentity: input.brand,
  };

  try {
    const message = await client.messages.create({
      model,
      max_tokens,
      messages: [
        {
          role: "user",
          content: `${LOGO_JSON_INSTRUCTIONS}

CONTEXT (JSON):
${JSON.stringify(payload)}`,
        },
      ],
    });

    await logClaudeMessageUsage("generate_brand_logo", model, message.usage);

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Geen tekst-antwoord voor logo-candidates." };
    }

    const parsed = parseModelJsonObject(textBlock.text);
    if (!parsed.ok) {
      return { ok: false, error: "Logo-antwoord is geen geldige JSON." };
    }

    const validated = logoCandidatesResponseSchema.safeParse(parsed.value);
    if (!validated.success) {
      return { ok: false, error: validated.error.message };
    }

    return { ok: true, candidates: validated.data.candidates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generateLogoCandidatesWithClaude mislukt.";
    return { ok: false, error: msg };
  }
}
