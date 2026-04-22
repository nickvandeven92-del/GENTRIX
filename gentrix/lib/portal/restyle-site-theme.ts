import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
  type TailwindSectionsPayload,
} from "@/lib/ai/tailwind-sections-schema";
import { sanitizeTailwindFragment } from "@/lib/site/tailwind-page-html";
import { buildPortalThemePresets, type PortalThemePreset } from "@/lib/portal/portal-theme-presets";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Claude krijgt **alle** secties van één pagina-groep tegelijk (meestal 5–12 stuks).
 * Hij moet **elke** sectie terugleveren met aangepaste kleuren — geen subset.
 * We laten `max(40)` toe om ook grotere home-pages te dekken; typische groepen zitten ver onder.
 */
const restyleOutputSchema = z.object({
  sections: z
    .array(
      z.object({
        index: z.number().int().min(0),
        html: z.string().min(1).max(120_000),
      }),
    )
    .min(1)
    .max(40),
});

export type PortalThemePresetId = PortalThemePreset["id"];

export type RestyleSiteThemeResult =
  | { ok: true; payload: TailwindSectionsPayload; targetConfig: TailwindPageConfig }
  | { ok: false; error: string; status?: number };

type RestylePageGroupResult =
  | { ok: true; sections: TailwindSection[] }
  | { ok: false; error: string };

function previewBodyHtml(section: TailwindSection): string {
  const html = section.html ?? "";
  if (html.length <= 120) return html;
  return `${html.slice(0, 120)}…`;
}

function describeThemeForPrompt(config: TailwindPageConfig): string {
  if (isLegacyTailwindPageConfig(config)) {
    return `- Primary: ${config.primaryColor}\n- (legacy config — geen extra palet-rollen)`;
  }
  const t = config.theme;
  const lines = [
    `- Primary:   ${t.primary}`,
    `- Accent:    ${t.accent}`,
  ];
  if (t.secondary?.trim()) lines.push(`- Secondary: ${t.secondary}`);
  if (t.background?.trim()) lines.push(`- Background: ${t.background}`);
  if (t.textColor?.trim()) lines.push(`- Text:       ${t.textColor}`);
  if (t.textMuted?.trim()) lines.push(`- Muted text: ${t.textMuted}`);
  return lines.join("\n");
}

function buildRestyleStaticBlock(): string {
  return `Je restyle-t een **bestaande** landingspagina naar een nieuw kleurenpalet. Je krijgt alle secties van één pagina-groep (bv. home, contact, een sub-pagina). **Doel:** de site ziet er straks uit alsof hij vanaf het begin in het nieuwe palet ontworpen is — **geen** CSS-filter-effect, **geen** half-herverfde kaart met achtergebleven oude kleuren.

=== WAT JE **WEL** MAG AANPASSEN ===
- **Tailwind achtergrond-klassen** (\`bg-white\`, \`bg-neutral-*\`, \`bg-stone-*\`, \`bg-zinc-*\`, \`bg-slate-*\`, \`bg-gray-*\`, \`bg-black\`, \`bg-emerald-*\`, \`bg-amber-*\`, **arbitrary hex** zoals \`bg-[#1a1a1a]\`).
- **Tekst-kleur klassen** (\`text-white\`, \`text-black\`, \`text-zinc-*\`, \`text-neutral-*\`, \`text-[#...]\`), inclusief hover/focus variaties (\`hover:text-*\`, \`focus:text-*\`).
- **Border-, ring-, divide- en outline-kleurklassen** (\`border-zinc-*\`, \`ring-black/10\`, \`divide-stone-200\`, \`outline-*\`, hex varianten).
- **Gradient stops** (\`from-*\`, \`via-*\`, \`to-*\`, \`bg-gradient-to-*\`, arbitrary hex in gradients).
- **Shadow-kleuren** als ze expliciet een kleur hebben (\`shadow-black/20\`, \`shadow-[rgba(…)]\`).
- **Inline \`style\`** met \`color\`, \`background\`, \`background-color\`, \`border-color\`, \`fill\`, \`stroke\` — hex/rgb/rgba/hsl waarden.
- **SVG \`fill=\`/\`stroke=\`** attributen als ze een kleur bevatten (geen \`currentColor\`).

=== WAT JE NIET MAG AANPASSEN (strikt behouden) ===
- **Alle tekst-inhoud**: koppen, alinea's, knop-labels, alt-teksten, kleine copy, lijstitems, FAQ, labels — letterlijk identiek.
- **Structuur & layout**: alle \`flex\`, \`grid\`, \`col-*\`, \`gap-*\`, \`p-*\`, \`px-*\`, \`py-*\`, \`m-*\`, \`space-*\`, \`w-*\`, \`max-w-*\`, \`min-h-*\`, \`h-*\`, \`rounded-*\`, \`overflow-*\`, breakpoints (\`sm:\`, \`md:\`, \`lg:\`, \`xl:\`) — geen enkel.
- **Typografie-maten & -stijl**: \`text-sm\`, \`text-4xl\`, \`font-semibold\`, \`tracking-*\`, \`leading-*\`, \`uppercase\`, \`italic\` — ongewijzigd.
- **Attributen**: \`href\`, \`id\`, \`src\`, \`alt\`, \`title\`, \`name\`, \`type\`, \`role\`, \`aria-*\`, \`tabindex\`, \`target\`, \`rel\` — ongewijzigd.
- **Alle \`data-*\`-attributen**: \`data-portal-*\`, \`data-aos\`, \`data-animation\`, \`data-lucide\`, \`data-section\`, \`data-studio-*\` — **NIET AANRAKEN**.
- **Alpine.js**: \`x-data\`, \`x-show\`, \`x-if\`, \`x-for\`, \`x-bind\`, \`x-on\`, \`@click\`, \`:class\`, \`:style\` — **NIET AANRAKEN**. Als er expressies met kleur-literals in \`:class\` staan, mag je die literals hertalen, maar de structuur en trigger blijven.
- **Iconen**: \`<svg>\`-paden en viewboxen identiek; alleen kleur-attributen mogen mee.
- **Afbeeldings-URL's**: \`src\` blijft gelijk.
- **Script/Style tags**: niet toevoegen, niet verwijderen. (Er horen er toch geen in fragmenten.)

=== TRANSFORMATIE-STRATEGIE ===
1. Bepaal per sectie welke kleurrol elk element draagt: **achtergrond-oppervlak**, **tekst (body/kop/muted)**, **primaire CTA**, **accent**, **border/scheiding**.
2. Map die rol naar het nieuwe palet:
   - Lichte sectie-achtergrond → een variant rond \`theme.background\` (mag subtiel afwijken: iets lichter/donkerder voor ritme).
   - Donkere sectie-achtergrond in donkere thema's → diepere variant van \`theme.background\` of een navy/bijna-zwart dat bij primary past.
   - CTA / primaire knop → \`theme.primary\` als solide fill met contrasterend tekstkleur; hover = iets donkerder/lichter.
   - Secundaire knop / outlined → border in \`theme.primary\` of \`theme.accent\`; tekst in primary.
   - Kleine highlights, badges, onderstrepingen, iconen-achter-tekst → \`theme.accent\`.
   - Body-tekst → \`theme.textColor\`; dempere caption/meta → \`theme.textMuted\`.
   - Borders/scheidingen → zeer subtiele tint van primary of textColor met lage opacity.
3. **Contrast**: zorg dat elke tekst leesbaar is op zijn nieuwe achtergrond (minimaal ~4.5:1 voor body, ~3:1 voor display). Bij twijfel: kies de donkerste/lichtste variant uit het palet.
4. **Consistent palet**: gebruik door de hele sectie de **zelfde** hex-waarden uit het doel-palet. Geen losse \`#ff6b35\`-achtige vreemde eend erbij.
5. **Arbitrary hex mag**: \`bg-[#abcdef]\` is prima als de named Tailwind-schaal niet precies matcht — gebruik de hex-waarden uit het doel-palet direct.

=== OUTPUT (strikt JSON) ===
Geef **uitsluitend** één JSON-object terug, geen markdown, geen code fences, geen inleidende tekst:

{
  "sections": [
    { "index": 0, "html": "<section …>…</section>" },
    { "index": 1, "html": "<section …>…</section>" },
    …
  ]
}

**Verplicht**: \`sections\` bevat **precies** alle indices die in de input staan (0 t/m N-1), in oplopende volgorde, elk met volledig herschreven HTML. Geen enkele sectie overslaan — ook niet als er "bijna niks" veranderde; wel het minimum: oude kleur-klassen/hexes vervangen door doel-palet-equivalenten.`;
}

function buildRestyleDynamicBlock(
  targetConfig: TailwindPageConfig,
  sections: TailwindSection[],
  pageLabel: string,
): string {
  const sectionsForPrompt = sections.map((s, i) => ({
    index: i,
    sectionName: s.sectionName,
    html: s.html,
  }));

  return `=== DOEL-PALET (config.theme van de site na de restyle) ===
${describeThemeForPrompt(targetConfig)}

=== PAGINA-GROEP ===
Je restyle-t nu de secties van: **${pageLabel}**. Secties van andere pagina-groepen (home, contact, sub-pagina's) worden in aparte aanroepen gedaan — focus je alleen op wat hieronder staat.

=== HUIDIGE SECTIES (JSON) ===
${JSON.stringify(sectionsForPrompt)}

=== OPDRACHT ===
Herteken élke sectie hierboven met kleuren uit het doel-palet. Volg strikt de regels uit het statische blok. Lever **alle ${sections.length}** indices in \`sections\`, in oplopende volgorde.`;
}

async function restyleOnePageGroup(
  client: Anthropic,
  model: string,
  targetConfig: TailwindPageConfig,
  sections: TailwindSection[],
  pageLabel: string,
): Promise<RestylePageGroupResult> {
  if (sections.length === 0) return { ok: true, sections: [] };

  const systemBlocks: TextBlockParam[] = [
    {
      type: "text",
      text: "Je bent een nauwkeurige front-end kleuren-stylist. Je wijzigt enkel kleuren; tekst, layout en attributen blijven identiek.",
    },
  ];

  const userContent: ContentBlockParam[] = [
    { type: "text", text: buildRestyleStaticBlock(), cache_control: { type: "ephemeral" } },
    { type: "text", text: buildRestyleDynamicBlock(targetConfig, sections, pageLabel) },
  ];

  const message = await client.messages.create({
    model,
    max_tokens: clampMaxTokensNonStreaming(model, 32_000),
    system: systemBlocks,
    messages: [{ role: "user", content: userContent }],
  });

  await logClaudeMessageUsage("restyle_site_theme", model, message.usage);

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: `Geen tekst-antwoord van Claude voor groep "${pageLabel}".` };
  }

  const parsed = parseModelJsonObject(textBlock.text);
  if (!parsed.ok) {
    const truncated =
      message.stop_reason === "max_tokens" ? " Antwoord mogelijk afgekapt (max_tokens)." : "";
    return {
      ok: false,
      error: `Antwoord voor groep "${pageLabel}" is geen geldige JSON.${truncated}`,
    };
  }

  const validated = restyleOutputSchema.safeParse(parsed.value);
  if (!validated.success) {
    return {
      ok: false,
      error: `Restyle-antwoord voor groep "${pageLabel}" voldoet niet aan het schema: ${validated.error.issues.map((i) => i.message).join(" ")}`,
    };
  }

  const out = sections.map((s) => ({ ...s }));
  const seen = new Set<number>();
  for (const item of validated.data.sections) {
    if (item.index < 0 || item.index >= out.length) {
      return {
        ok: false,
        error: `Claude gaf sectie-index ${item.index} terug voor "${pageLabel}"; geldig is 0..${out.length - 1}.`,
      };
    }
    if (seen.has(item.index)) {
      return {
        ok: false,
        error: `Claude gaf sectie-index ${item.index} dubbel terug voor "${pageLabel}".`,
      };
    }
    seen.add(item.index);
    const cleaned = sanitizeTailwindFragment(item.html);
    if (!cleaned.trim()) {
      return {
        ok: false,
        error: `Sectie ${item.index} in groep "${pageLabel}" werd leeg na sanitization.`,
      };
    }
    out[item.index] = { ...out[item.index]!, html: cleaned };
  }

  const missing: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (!seen.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Claude miste secties in groep "${pageLabel}": indices ${missing.join(", ")}. Eerste gemiste sectie (index ${missing[0]}): "${previewBodyHtml(sections[missing[0]!]!)}"`,
    };
  }

  return { ok: true, sections: out };
}

/**
 * Haalt de doel-config op voor een preset. Als basis gebruiken we **altijd** de meegegeven
 * `baseConfig` (typisch de huidige payload-config); de preset-builder leidt daar donker/warm
 * van af. Voor `"original"` is er geen transformatie: we hergebruiken `baseConfig` zelf.
 *
 * Voor een lossless "Origineel → Donker → Origineel"-rondgang moet de caller de **echte**
 * originele config aanleveren (bv. door die client-side uit `basePageConfigRef` te pakken).
 */
export function resolvePortalThemeTargetConfig(
  baseConfig: TailwindPageConfig,
  themeId: PortalThemePresetId,
): TailwindPageConfig | null {
  if (isLegacyTailwindPageConfig(baseConfig)) return null;
  const presets = buildPortalThemePresets(baseConfig);
  const hit = presets.find((p) => p.id === themeId);
  return hit?.pageConfig ?? null;
}

export async function restyleSitePayloadToTheme(options: {
  payload: TailwindSectionsPayload;
  targetConfig: TailwindPageConfig;
}): Promise<RestyleSiteThemeResult> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
      status: 500,
    };
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const main = await restyleOnePageGroup(client, model, options.targetConfig, options.payload.sections, "home");
  if (!main.ok) return { ok: false, error: main.error, status: 502 };

  let contactSections = options.payload.contactSections;
  if (contactSections && contactSections.length > 0) {
    const r = await restyleOnePageGroup(client, model, options.targetConfig, contactSections, "contact");
    if (!r.ok) return { ok: false, error: r.error, status: 502 };
    contactSections = r.sections;
  }

  let marketingPages = options.payload.marketingPages;
  if (marketingPages && Object.keys(marketingPages).length > 0) {
    const nextMarketing: Record<string, TailwindSection[]> = {};
    for (const [pageKey, secs] of Object.entries(marketingPages)) {
      const r = await restyleOnePageGroup(client, model, options.targetConfig, secs, pageKey);
      if (!r.ok) return { ok: false, error: r.error, status: 502 };
      nextMarketing[pageKey] = r.sections;
    }
    marketingPages = nextMarketing;
  }

  const nextPayload: TailwindSectionsPayload = {
    ...options.payload,
    config: options.targetConfig,
    sections: main.sections,
    ...(contactSections ? { contactSections } : {}),
    ...(marketingPages ? { marketingPages } : {}),
  };

  return { ok: true, payload: nextPayload, targetConfig: options.targetConfig };
}
