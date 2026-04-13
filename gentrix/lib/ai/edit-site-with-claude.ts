import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { getAlpineInteractivityPromptBlock } from "@/lib/ai/interactive-alpine-prompt";
import { getKnowledgeContextForClaude } from "@/lib/data/ai-knowledge";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { mergeTailwindSectionUpdates, tailwindSectionUpdateSchema } from "@/lib/ai/merge-tailwind-section-updates";
import {
  isLegacyTailwindPageConfig,
  masterPromptPageConfigSchema,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const editSiteOutputSchema = z
  .object({
    sectionUpdates: z.array(tailwindSectionUpdateSchema).max(24).optional(),
    config: masterPromptPageConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const n = data.sectionUpdates?.length ?? 0;
    const hasConfig = data.config !== undefined;
    if (n === 0 && !hasConfig) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Antwoord moet minstens één item in sectionUpdates bevatten en/of een config-object (bij alleen thema/kleuren).",
        path: ["sectionUpdates"],
      });
    }
  });

export type EditSiteResult =
  | { ok: true; sections: TailwindSection[]; config: TailwindPageConfig | null | undefined }
  | { ok: false; error: string; rawText?: string };

function buildEditUserPrompt(
  instruction: string,
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
): string {
  const legacy = config != null && isLegacyTailwindPageConfig(config);
  const currentPayload = {
    config: config ?? null,
    sections: sections.map((s, i) => ({
      index: i,
      sectionName: s.sectionName,
      html: s.html,
    })),
  };

  const configRule = legacy
    ? `De huidige \`config\` is **legacy** (themeName, primaryColor, …). Je mag **geen** nieuwe \`config\` in je antwoord zetten — alleen \`sectionUpdates\` voor HTML-wijzigingen.`
    : `Als de gebruiker **expliciet** kleuren, typografie of algemene stijl (\`config\`) wil wijzigen, mag je een volledig \`config\`-object meesturen (master-formaat: style, font, \`theme\` met minstens primary/accent en optioneel secondary, background, textColor, textMuted, vibe, typographyStyle, borderRadius, shadowScale, spacingScale, secundaire tinten). Anders laat je \`config\` weg.`;

  return `Je past een **bestaande** landingspagina aan. De site bestaat uit HTML-fragmenten per sectie met Tailwind utility-classes (iframe-preview laadt Alpine.js voor micro-interacties).

${getAlpineInteractivityPromptBlock()}

=== TECHNISCHE REGELS ===
- Geldige HTML in elk \`html\`-veld: geen \`<script>\` of \`<style>\` in het fragment, geen klassieke inline event-handlers (\`onclick=\`), geen \`javascript:\` links; Alpine-attributen (\`x-*\`, \`@\`, \`:\`) wel volgens het blok hierboven.
- Afbeeldingen: alleen **https** (bijv. images.unsplash.com).
- Behoud **ankers en \`id\`’s** die naar andere secties linken (\`#features\`, \`#pricing\`, …) tenzij de gebruiker vraagt ze te wijzigen; houd ze dan consistent.
- **Geen dubbele navbar:** maximaal **één** globale \`<header>\`/\`<nav>\` met de hoofdlinks; verwijder een tweede identieke menulijst als de gebruiker dat impliciet wil (rommel / dubbel).
- Behoud **data-animation**, **data-aos** (AOS) en **data-lucide** waar zinvol; je mag ze toevoegen of aanpassen. **Niet** \`data-aos\` en \`data-animation\` op hetzelfde element. **GSAP:** shell laadt \`gsap\` + plugins; **geen** nieuwe \`<script>\` in sectie-HTML — alleen markup/selectors; gebruikers-GSAP hoort in **Eigen JS**. Marquee/ticker: \`studio-marquee\` + \`studio-marquee-track\` met **dubbele** identieke inhoud; geen \`data-animation\` op de track. **Laser:** niet **nieuw** toevoegen tenzij de gebruiker **expliciet** om neon/cyber/scan vraagt; bestaande \`studio-laser-*\` mag je laten of verwijderen als het niet bij de opdracht past.
- Mobiel: layouts moeten met Tailwind breakpoints (\`sm:\`, \`md:\`, \`lg:\`) bruikbaar blijven.

=== OUTPUT (strikt) ===
Lever **uitsluitend** één JSON-object. Geen markdown, geen code fences.

**Belangrijk — kosten en snelheid:** zet **alleen** secties in \`sectionUpdates\` die je **echt** wijzigt. Voorbeeld: alleen navbar-dropdown → één object met die sectie-index; alleen footer-links → één object voor de footer-sectie. **Nooit** ongewijzigde secties opnieuw uitschrijven.

Vorm:
{
  "sectionUpdates": [
    { "index": 0, "html": "<section class=\\"...\\">...</section>", "sectionName": "optioneel als je het label wijzigt" }
  ],
  "config": { ... }  // optioneel; zie hieronder
}

**Indices:** secties in de JSON hierboven hebben \`index\` 0 t/m ${sections.length - 1}. Elk item in \`sectionUpdates\` heeft \`index\` (integer) + volledige nieuwe \`html\` voor **die ene** sectie. Meerdere secties wijzigen mag, maar **geen dubbele index** in \`sectionUpdates\`.

${configRule}

=== HUIDIGE SITE (JSON) ===
${JSON.stringify(currentPayload)}

=== VERZOEK VAN DE GEBRUIKER ===
${instruction}`;
}

export async function editSiteWithClaude(
  instruction: string,
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
): Promise<EditSiteResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
    };
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const { systemText: knowledge, userPrefixBlocks } = await getKnowledgeContextForClaude();
  const system = [
    knowledge,
    "Je bent een nauwkeurige front-end editor. Je wijzigt alleen wat gevraagd wordt; in JSON lever je minimaal sectionUpdates (alleen gewijzigde indices) en volgt het outputformaat exact.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const editBody = buildEditUserPrompt(instruction, sections, config);
  const userContent: string | ContentBlockParam[] =
    userPrefixBlocks.length > 0
      ? [
          ...userPrefixBlocks,
          {
            type: "text",
            text: `\n\n=== OPDRACHT (site bewerken) ===\n\n${editBody}`,
          },
        ]
      : editBody;

  const message = await client.messages.create({
    model,
    max_tokens: clampMaxTokensNonStreaming(model, 24_576),
    system,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
  });

  await logClaudeMessageUsage("edit_site", model, message.usage);

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "Geen tekst-antwoord van Claude ontvangen." };
  }

  const parsedResult = parseModelJsonObject(textBlock.text);
  if (!parsedResult.ok) {
    const truncated =
      message.stop_reason === "max_tokens"
        ? " Antwoord mogelijk afgekapt (max_tokens)."
        : "";
    return {
      ok: false,
      error: `Antwoord is geen geldige JSON.${truncated}`,
      rawText: textBlock.text,
    };
  }
  const parsed = parsedResult.value;

  const validated = editSiteOutputSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `JSON voldoet niet aan het schema: ${validated.error.message}`,
      rawText: textBlock.text,
    };
  }

  const updates = validated.data.sectionUpdates ?? [];
  const mergeResult = mergeTailwindSectionUpdates(sections, updates);
  if (!mergeResult.ok) {
    return { ok: false, error: mergeResult.error, rawText: textBlock.text };
  }

  let nextConfig: TailwindPageConfig | null | undefined = config;
  if (validated.data.config) {
    if (config != null && isLegacyTailwindPageConfig(config)) {
      nextConfig = config;
    } else {
      nextConfig = validated.data.config;
    }
  }

  return { ok: true, sections: mergeResult.sections, config: nextConfig };
}
