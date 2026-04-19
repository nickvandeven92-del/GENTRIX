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

export type ResolveTargetSectionIndicesResult =
  | { ok: true; indices: number[] | null }
  | { ok: false; error: string };

/**
 * Unieke, gesorteerde indices binnen bereik; `indices: null` = geen scope (volledige HTML voor alle secties).
 * Geeft fout terug bij een index buiten 0..sectionCount-1 of niet-geheel getal.
 */
export function resolveTargetSectionIndices(
  targetIndices: number[] | undefined,
  sectionCount: number,
): ResolveTargetSectionIndicesResult {
  if (targetIndices == null || targetIndices.length === 0) {
    return { ok: true, indices: null };
  }
  const seen = new Set<number>();
  for (const raw of targetIndices) {
    if (!Number.isInteger(raw) || raw < 0 || raw >= sectionCount) {
      return {
        ok: false,
        error: `Ongeldige target_section_indices: ${String(raw)} (geldig: 0 t/m ${Math.max(0, sectionCount - 1)}).`,
      };
    }
    seen.add(raw);
  }
  return { ok: true, indices: [...seen].sort((a, b) => a - b) };
}

/**
 * Optie A: afleiden welke secties bedoeld zijn als de instructie de sectienaam bevat (substring-match).
 * Leeg array = geen match; caller laat dan `targetIndices` weg voor volledige context.
 */
export function inferTargetIndicesFromInstruction(
  instruction: string,
  sections: TailwindSection[],
): number[] {
  const lower = instruction.toLowerCase();
  const out: number[] = [];
  sections.forEach((s, i) => {
    const name = (s.sectionName ?? "").trim().toLowerCase();
    if (name.length >= 2 && lower.includes(name)) {
      out.push(i);
    }
  });
  return out;
}

function buildEditUserPrompt(
  instruction: string,
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  scoped: number[] | null,
): string {
  const legacy = config != null && isLegacyTailwindPageConfig(config);

  const sectionIndex = sections.map((s, i) => {
    const row: {
      index: number;
      sectionName: string;
      semanticRole?: string;
    } = { index: i, sectionName: s.sectionName };
    if (s.semanticRole != null) row.semanticRole = s.semanticRole;
    return row;
  });

  const targetSections =
    scoped != null
      ? scoped.map((i) => {
          const s = sections[i]!;
          return {
            index: i,
            sectionName: s.sectionName,
            html: s.html,
            ...(s.semanticRole != null ? { semanticRole: s.semanticRole } : {}),
            ...(s.copyIntent != null ? { copyIntent: s.copyIntent } : {}),
          };
        })
      : sections.map((s, i) => ({
          index: i,
          sectionName: s.sectionName,
          html: s.html,
          ...(s.semanticRole != null ? { semanticRole: s.semanticRole } : {}),
          ...(s.copyIntent != null ? { copyIntent: s.copyIntent } : {}),
        }));

  const currentPayload =
    scoped != null
      ? {
          config: config ?? null,
          sectionIndex,
          targetSections,
        }
      : {
          config: config ?? null,
          sections: targetSections,
        };

  const scopeBlock =
    scoped != null
      ? `=== SECTIE-OVERZICHT (alle secties — alleen index, naam, optioneel semanticRole; geen HTML) ===
${JSON.stringify(sectionIndex)}

=== TE BEWERKEN SECTIES (volledige HTML — pas inhoudelijk alleen deze aan) ===
${JSON.stringify(targetSections)}

**Scope (strikt):** Gebruik in \`sectionUpdates\` **uitsluitend** \`index\`-waarden die in **targetSections** voorkomen (${scoped.join(", ")}). Wijzig **geen** andere secties, ook niet voor “kleine verbeteringen” of consistentie, tenzij de gebruiker dat expliciet vraagt — dan verwachten we een nieuwe beurt met ruimere scope.
`
      : `=== HUIDIGE SITE (JSON — alle secties met volledige HTML) ===
${JSON.stringify(currentPayload)}
`;

  const configRule = legacy
    ? `De huidige \`config\` is **legacy** (themeName, primaryColor, …). Je mag **geen** nieuwe \`config\` in je antwoord zetten — alleen \`sectionUpdates\` voor HTML-wijzigingen.`
    : `Als de gebruiker **expliciet** kleuren, typografie of algemene stijl (\`config\`) wil wijzigen, mag je een volledig \`config\`-object meesturen (master-formaat: style, font, \`theme\` met minstens primary/accent en optioneel secondary, background, textColor, textMuted, vibe, typographyStyle, borderRadius, shadowScale, spacingScale, secundaire tinten). Anders laat je \`config\` weg.`;

  return `Je past een **bestaande** landingspagina aan. De site bestaat uit HTML-fragmenten per sectie met Tailwind utility-classes (iframe-preview laadt Alpine.js voor micro-interacties).

${getAlpineInteractivityPromptBlock()}

=== TECHNISCHE REGELS ===
- Geldige HTML in elk \`html\`-veld: geen \`<script>\` of \`<style>\` in het fragment, geen klassieke inline event-handlers (\`onclick=\`), geen \`javascript:\` links; Alpine-attributen (\`x-*\`, \`@\`, \`:\`) wel volgens het blok hierboven.
- Afbeeldingen: alleen **https** (eigen of klant-URL's; geen generieke stock-services tenzij de briefing dat expliciet noemt).
- Behoud **ankers en \`id\`’s** die naar andere secties linken (\`#features\`, \`#pricing\`, …) tenzij de gebruiker vraagt ze te wijzigen; houd ze dan consistent.
- **Geen dubbele navbar:** maximaal **één** globale \`<header>\`/\`<nav>\` met de hoofdlinks; verwijder een tweede identieke menulijst als de gebruiker dat impliciet wil (rommel / dubbel).
- Behoud **data-animation**, **data-aos** (AOS) en **data-lucide** waar zinvol; je mag ze toevoegen of aanpassen. **Niet** \`data-aos\` en \`data-animation\` op hetzelfde element. **GSAP:** shell laadt \`gsap\` + plugins; **geen** nieuwe \`<script>\` in sectie-HTML — alleen markup/selectors; gebruikers-GSAP hoort in **Eigen JS**. **Marquee/ticker (verboden):** verwijder \`studio-marquee\`, \`studio-marquee-track\` en \`<marquee>\`; toon logo's/trust **stilstaand** (grid of vaste rij). **Laser:** niet **nieuw** toevoegen tenzij de gebruiker **expliciet** om neon/cyber/scan vraagt; bestaande \`studio-laser-*\` mag je laten of verwijderen als het niet bij de opdracht past.
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

${scopeBlock}

=== VERZOEK VAN DE GEBRUIKER ===
${instruction}`;
}

export async function editSiteWithClaude(
  instruction: string,
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  targetIndices?: number[],
): Promise<EditSiteResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
    };
  }

  const resolved = resolveTargetSectionIndices(targetIndices, sections.length);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  const scoped = resolved.indices;

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const { systemText: knowledge, userPrefixBlocks } = await getKnowledgeContextForClaude();
  const system = [
    knowledge,
    scoped != null
      ? "Je bent een nauwkeurige front-end editor. Deze opdracht heeft een **beperkte scope**: wijzig alleen secties die in de prompt als target staan; geen andere indices in sectionUpdates."
      : "Je bent een nauwkeurige front-end editor. Je wijzigt alleen wat gevraagd wordt; in JSON lever je minimaal sectionUpdates (alleen gewijzigde indices) en volgt het outputformaat exact.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const editBody = buildEditUserPrompt(instruction, sections, config, scoped);
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
  if (scoped != null && updates.length > 0) {
    const allowed = new Set(scoped);
    const bad = updates.find((u) => !allowed.has(u.index));
    if (bad) {
      return {
        ok: false,
        error: `Het model wijzigde sectie-index ${bad.index}, maar deze opdracht is beperkt tot: ${scoped.join(", ")}.`,
        rawText: textBlock.text,
      };
    }
  }
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
