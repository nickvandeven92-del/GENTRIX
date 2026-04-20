import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { ANTHROPIC_KEY_MISSING_USER_HINT, getAnthropicApiKey } from "@/lib/ai/anthropic-env";
import { clampMaxTokensNonStreaming } from "@/lib/ai/anthropic-nonstream-limits";
import { getAlpineInteractivityPromptBlock } from "@/lib/ai/interactive-alpine-prompt";
import { getKnowledgeContextForClaude } from "@/lib/data/ai-knowledge";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import { mergeSiteChatSectionsWithOptionalAiHero } from "@/lib/ai/ai-hero-image-postprocess";
import { mergeTailwindSectionUpdates, tailwindSectionUpdateSchema } from "@/lib/ai/merge-tailwind-section-updates";
import { stripAllUnsplashFromSections } from "@/lib/ai/strip-unsplash-urls";
import { extractPartialReplyFromStreamingSiteChatJson } from "@/lib/ai/site-chat-reply-extract";
import {
  inferTargetIndicesFromInstruction,
  resolveTargetSectionIndices,
} from "@/lib/ai/edit-site-with-claude";
import {
  isLegacyTailwindPageConfig,
  masterPromptPageConfigSchema,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const chatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(32000),
});

export const siteChatRequestMessagesSchema = z.array(chatTurnSchema).min(1).max(40);

const chatResponseSchema = z.object({
  reply: z.string().min(1).max(24000),
  sectionUpdates: z.array(tailwindSectionUpdateSchema).min(1).max(24).optional(),
  config: masterPromptPageConfigSchema.optional(),
});

export type SiteChatTurn = z.infer<typeof chatTurnSchema>;

export type SiteChatResult =
  | {
      ok: true;
      reply: string;
      sections?: TailwindSection[];
      config?: TailwindPageConfig | null | undefined;
    }
  | { ok: false; error: string; rawText?: string };

function buildSitePayload(sections: TailwindSection[], config: TailwindPageConfig | null | undefined) {
  return {
    config: config ?? null,
    sections: sections.map((s, i) => ({
      index: i,
      sectionName: s.sectionName,
      html: s.html,
      semanticRole: s.semanticRole,
      copyIntent: s.copyIntent,
    })),
  };
}

/** JSON voor Claude: volledige site, of alleen targetSections met volledige HTML + sectionIndex-overzicht. */
function buildChatPayloadForModel(
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  scopedIndices: readonly number[] | null,
): unknown {
  if (scopedIndices == null || scopedIndices.length === 0) {
    return buildSitePayload(sections, config);
  }
  const sectionIndex = sections.map((s, i) => {
    const row: {
      index: number;
      sectionName: string;
      semanticRole?: string;
      id?: string;
    } = { index: i, sectionName: s.sectionName };
    if (s.semanticRole != null) row.semanticRole = s.semanticRole;
    if (s.id != null) row.id = s.id;
    return row;
  });
  const targetSections = scopedIndices.map((i) => {
    const s = sections[i]!;
    return {
      index: i,
      sectionName: s.sectionName,
      html: s.html,
      ...(s.semanticRole != null ? { semanticRole: s.semanticRole } : {}),
      ...(s.copyIntent != null ? { copyIntent: s.copyIntent } : {}),
      ...(s.id != null ? { id: s.id } : {}),
    };
  });
  return {
    config: config ?? null,
    sectionIndex,
    targetSections,
  };
}

/**
 * Bepaalt welke secties deze beurt “scoped” zijn (minder tokens + harde index-check na het model).
 * Expliciete indices (API) overschrijven inferentie uit het laatste gebruikersbericht.
 */
export function resolveSiteChatTargetIndices(
  messages: SiteChatTurn[],
  sections: TailwindSection[],
  explicitTargetSectionIndices?: readonly number[] | null,
): readonly number[] | null {
  if (explicitTargetSectionIndices != null && explicitTargetSectionIndices.length > 0) {
    const r = resolveTargetSectionIndices([...explicitTargetSectionIndices], sections.length);
    return r.ok && r.indices != null ? r.indices : null;
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return null;
  const inferred = inferTargetIndicesFromInstruction(last.content, sections);
  if (inferred.length === 0) return null;
  const r2 = resolveTargetSectionIndices(inferred, sections.length);
  return r2.ok && r2.indices != null ? r2.indices : null;
}

function buildClaudeMessages(
  messages: SiteChatTurn[],
  payload: unknown,
  scopedIndices: readonly number[] | null,
  attachmentUrls: string[],
  knowledgePrefixBlocks: ContentBlockParam[],
): MessageParam[] {
  const out: MessageParam[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i];
    out.push({ role: m.role, content: m.content });
  }
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") {
    throw new Error("Laatste bericht moet van de gebruiker zijn.");
  }
  const attach =
    attachmentUrls.length > 0
      ? `\n\nGeüploade afbeelding-URL's (gebruik als src in <img> in de passende sectie, bijv. logo in header/hero):\n${attachmentUrls.map((u) => `- ${u}`).join("\n")}`
      : "";
  const scopedBlock =
    scopedIndices != null && scopedIndices.length > 0
      ? `

=== Scope (deze beurt) ===
Volledige HTML staat alleen onder **targetSections**. **sectionIndex** somt alle secties zonder HTML (context voor ankertjes en volgorde).
In \`sectionUpdates\` mag je **uitsluitend** deze indices wijzigen: ${scopedIndices.join(", ")}. Geen wijzigingen aan andere secties — ook niet voor “kleine” consistentie-fixes. Algemene thema/kleuren via \`config\` blijft toegestaan als de gebruiker dat expliciet vraagt.
`
      : "";
  const tailText = `${last.content}${attach}\n\n---\nHuidige website (JSON)${scopedIndices != null && scopedIndices.length > 0 ? " — beperkte scope voor deze beurt" : " — alle secties"}:\n${JSON.stringify(payload)}\n---${scopedBlock}`;

  if (knowledgePrefixBlocks.length === 0) {
    out.push({ role: "user", content: tailText });
  } else {
    out.push({
      role: "user",
      content: [...knowledgePrefixBlocks, { type: "text", text: `\n\n=== SITE-CHAT (huidige beurt) ===\n\n${tailText}` }],
    });
  }
  return out;
}

export type SiteChatStudioModuleFlags = {
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
};

function buildStudioModulePromptBlock(flags: SiteChatStudioModuleFlags | undefined): string {
  if (
    flags == null ||
    (flags.appointmentsEnabled === undefined && flags.webshopEnabled === undefined)
  ) {
    return "";
  }
  const apptOn = flags.appointmentsEnabled !== false;
  const shopOn = flags.webshopEnabled !== false;
  return `=== STUDIO-MODULES (dit klantdossier) ===
- **Online boeken/afspraken:** ${apptOn ? "module **aan** — booking-sectie en boek-placeholders mogen in de site blijven zoals ze zijn, tenzij de gebruiker wijzigingen vraagt." : "module **uit** op de live site — voeg **geen** nieuwe plan-/boek-CTA’s, afspraak-blokken of studio-boekingspad-placeholders toe (ook niet in nav/footer). Herschrijf of verwijder de bestaande canonieke booking-sectie (buitenste id booking) niet zonder **expliciet** verzoek."}
- **Webshop / productmarketing:** ${shopOn ? "module **aan**." : "module **uit** op de live site — voeg **geen** nieuwe product-/winkel-CTA’s of studio-webshoppad-placeholders toe. Herschrijf of verwijder de canonieke shop-sectie (buitenste id shop) niet zonder **expliciet** verzoek."}`;
}

function buildChatSystemPrompt(legacy: boolean, studioModuleFlags?: SiteChatStudioModuleFlags): string {
  const configRule = legacy
    ? `Als je \`sections\` wijzigt: geen \`config\` in je antwoord (legacy-site).`
    : `Als de gebruiker kleuren/thema wil: je mag \`config\` (master: style, theme, font) meesturen. Anders weglaten.`;

  const moduleBlock = buildStudioModulePromptBlock(studioModuleFlags);
  const moduleSection = moduleBlock ? `\n\n${moduleBlock}\n` : "";

  return `Je bent een Nederlandstalige **senior front-end / UX-specialist** (alsof je decennialang lead bent op landingspagina’s voor MKB): rustig, nieuwsgierig, scherp op hiërarchie, conversie en toegankelijkheid — geen opgeblazen tone, wel vakmanschap en doorvragen waar dat de kwaliteit verhoogt.

${getAlpineInteractivityPromptBlock()}
${moduleSection}
GEDRAG:
- Beantwoord helder in \`reply\` (markdown toegestaan in plain text).
- **Consultatie eerst (sterk aanbevolen):** bij **vage, creatieve of grote ontwerpverzoeken** (nieuwe hero, andere sfeer/huisstijl, herschikken van secties, “luxer”, “anders”, enkele woorden zonder context): reageer in **dezelfde beurt** met **2 tot 4 gerichte vragen** (doelgroep, gewenste sfeer, wat mag wél/niet weg, mobiel vs. desktop-prioriteit, referentie). Laat in die beurt \`sectionUpdates\` en \`config\` **weg** — tenzij de gebruiker expliciet vraagt om **directe uitvoering** (bijv. “doe maar”, “implementeer”, “voer uit”, “geen vragen”, “fix dit”).
- **Direct uitvoeren mag** bij kleine, eenduidige technische verzoeken (bv. sticky header, contrast, typo, één class wijzigen) als de scope helder is; voeg hoogstens **één** korte verduidelijkingsvraag toe als er echt risico op verkeerde interpretatie is.
- Wijzig de site **alleen** als de gebruiker uitvoering wil of het verzoek zo concreet is dat wachten onzin is. Bij een puur inhoudelijke vraag zonder wijziging: laat \`sectionUpdates\` en \`config\` weg.
- **Streaming / leesvolgorde:** de UI toont het begin van \`reply\` al terwijl de rest van het antwoord nog binnenkomt. Begin \`reply\` daarom **niet** met formuleringen als “Het is klaar”, “Is nu gemaakt”, “Heb ik gedaan” of andere **voltooide** boodschap als eerste zin. Als je wél \`sectionUpdates\` meestuurt: begin met korte context of intentie (bijv. “Ik pas dit toe in de preview:”), werk daarna uit, en **sluit af** met een korte technische samenvatting (wat is waar aangepast). Zo voelt het niet alsof er “al klaar” wordt gezegd vóór de wijziging zichtbaar is.
- Als je HTML wijzigt: gebruik \`sectionUpdates\`: alleen objecten voor secties die **echt** veranderen, elk met \`index\` (zoals in de JSON) en volledige nieuwe \`html\` voor die sectie. Voorbeeld: alleen navbar → één update; alleen footer → één update. **Nooit** ongewijzigde secties opnieuw uitschrijven. Bevat het user-JSON een **Scope**-blok met toegestane indices, mag je **alleen** die indices in \`sectionUpdates\` gebruiken.
- HTML-regels: geen \`<script>\`/\`<style>\` in fragmenten, geen klassieke inline handlers, geen javascript:-links; Alpine (\`x-*\`, \`@\`, \`:\`) volgens het blok hierboven. Alleen https voor afbeeldingen.
- **Hero-beeld / stock:** zet **géén** \`<img src>\` of CSS-background naar **externe stock- of CDN-foto’s** (het model heeft **geen** stock-API; verzonnen \`https://…\` links zijn verboden). Toegestaan: **https**-URL’s die de gebruiker in dit gesprek heeft **geüpload**, of een hero met **gradient**, SVG of patronen. **Precies één** buitenste \`<section id="hero">\` per pagina — **nooit** een tweede \`id="hero"\` toevoegen (geen dubbele hero-blokken). **AOS (\`data-aos\`) en \`data-animation\`:** niet op die **buitenste** \`<section id="hero">\`-tag (volledige viewport + transform = overlap/ghost); wel op **binnenliggende** kolommen/kaarten/koppen. Vraagt de gebruiker om een **nieuwe / luxere / andere hero-foto**, klaagt over **dezelfde / identieke afbeelding**, of wil **opnieuw genereren**: leg in \`reply\` uit dat de **server** daarna **één** hero-raster genereert (**Google AI Studio / Gemini image**, fallback OpenAI) en host op Gentrix-opslag — **niet** met verwijzingen naar stockwebsites. Stuur in die beurt **minstens één** \`sectionUpdates\` voor de hero-sectie (mag minimaal zijn: overlay/klassen/copy) zodat de server-pipeline **daadwerkelijk** kan draaien; **geen** puur tekstantwoord zonder \`sectionUpdates\` als het verzoek al concreet is (bv. close-up, materiaal, belichting). Gebruik **geen** geüploade bestanden (bv. schermafbeelding) als full-bleed \`<img>\` of volledige-hero-achtergrond via Tailwind arbitrary background-url in \`#hero\` — anders blokkeert dat de server-side generatie; houd de hero geschikt voor injectie (copy/gradient bovenop, geen dominante foto-URL van een plaksel).
- Gebruik geüploade logo-URL's waar de gebruiker om vraagt.
- **Standaard uit tot toggle:** vraagt de gebruiker om iets dat **eerst onzichtbaar of inactief** moet blijven tot een knop/schakelaar: gebruik Alpine met startwaarde **false** (bv. \`x-data="{ open: false }"\`), inhoud met \`x-show="open"\` of \`hidden\` + \`:class\`, en eventueel vaste ruimte met \`min-h-*\` + \`invisible\` / \`opacity-0 pointer-events-none\` zolang \`open\` false is. Geen automatisch startende video, modal of agressieve animatie zonder expliciete gebruikersactie, tenzij de gebruiker dat zo wil.

OUTPUT: uitsluitend **één** JSON-object, geen markdown-fences eromheen:
{
  "reply": "je antwoord aan de gebruiker",
  "sectionUpdates": [ { "index": 0, "html": "..." } ]  // optioneel; alleen gewijzigde indices
  "config": { ... }    // optioneel; ${configRule}
}`;
}

export function processSiteChatFromModelText(
  modelText: string,
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  stopReason: string | null | undefined,
  allowedSectionIndices?: readonly number[] | null,
): SiteChatResult {
  const parsedResult = parseModelJsonObject(modelText);
  if (!parsedResult.ok) {
    const truncated = stopReason === "max_tokens" ? " Antwoord mogelijk afgekapt (max_tokens)." : "";
    return {
      ok: false,
      error: `Antwoord is geen geldige JSON.${truncated}`,
      rawText: modelText,
    };
  }
  const parsed = parsedResult.value;

  const validated = chatResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `JSON voldoet niet aan het schema: ${validated.error.message}`,
      rawText: modelText,
    };
  }

  const { reply, sectionUpdates, config: outConfig } = validated.data;

  if (
    allowedSectionIndices != null &&
    allowedSectionIndices.length > 0 &&
    sectionUpdates != null &&
    sectionUpdates.length > 0
  ) {
    const allowed = new Set(allowedSectionIndices);
    const bad = sectionUpdates.find((u) => !allowed.has(u.index));
    if (bad) {
      return {
        ok: false,
        error: `Het model wijzigde sectie-index ${bad.index}, maar deze beurt was beperkt tot: ${allowedSectionIndices.join(", ")}.`,
        rawText: modelText,
      };
    }
  }

  let nextConfig: TailwindPageConfig | null | undefined = config;
  if (outConfig) {
    if (config != null && isLegacyTailwindPageConfig(config)) {
      nextConfig = config;
    } else {
      nextConfig = outConfig;
    }
  }

  const hasUpdates = (sectionUpdates?.length ?? 0) > 0;
  const configRequested = outConfig !== undefined;

  if (!hasUpdates && !configRequested) {
    return { ok: true, reply };
  }

  if (!hasUpdates && configRequested) {
    if (config != null && isLegacyTailwindPageConfig(config)) {
      return { ok: true, reply };
    }
    return {
      ok: true,
      reply,
      sections: sections.map((s) => ({ ...s })),
      config: nextConfig,
    };
  }

  const mergeResult = mergeTailwindSectionUpdates(sections, sectionUpdates ?? []);
  if (!mergeResult.ok) {
    return { ok: false, error: mergeResult.error, rawText: modelText };
  }

  return { ok: true, reply, sections: mergeResult.sections, config: nextConfig };
}

export type SiteChatHeroPostProcessContext = {
  businessName: string;
  subfolderSlug?: string | null;
};

function sectionsEqual(a: TailwindSection[], b: TailwindSection[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].html !== b[i].html) return false;
  }
  return true;
}

/**
 * Na Claude: verwijdert gehallucineerde `images.unsplash.com`-URL’s uit **alle** teruggestuurde secties (geen API — pure string-sanitatie).
 * Optioneel daarna AI-hero (Gemini/OpenAI) wanneer `heroCtx` gezet is en het gebruikersbericht daarvoor kwalificeert.
 */
export async function finalizeSiteChatWithAiHeroPipeline(
  _baseSections: TailwindSection[],
  result: SiteChatResult,
  messages: SiteChatTurn[],
  heroCtx?: SiteChatHeroPostProcessContext,
): Promise<SiteChatResult> {
  if (!result.ok) return result;
  const okResult = result;
  if (okResult.sections === undefined) return okResult;

  const lastUser = messages[messages.length - 1]?.content ?? "";
  const stripped = stripAllUnsplashFromSections(okResult.sections);
  let nextSections = stripped;
  if (heroCtx) {
    nextSections = await mergeSiteChatSectionsWithOptionalAiHero(stripped, lastUser, heroCtx);
  }
  if (sectionsEqual(okResult.sections, nextSections)) return okResult;
  return {
    ok: true,
    reply: okResult.reply,
    sections: nextSections,
    ...("config" in okResult ? { config: okResult.config } : {}),
  };
}

export type SiteChatClaudeRequest = {
  client: Anthropic;
  model: string;
  system: TextBlockParam[];
  messages: MessageParam[];
  sections: TailwindSection[];
  config: TailwindPageConfig | null | undefined;
  /** Wanneer gezet: `sectionUpdates` mag alleen deze indices wijzigen (zelfde contract als `editSiteWithClaude`). */
  allowedSectionIndices: readonly number[] | null;
};

export async function buildSiteChatClaudeRequest(
  messages: SiteChatTurn[],
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  attachmentUrls: string[],
  studioModuleFlags?: SiteChatStudioModuleFlags,
  explicitTargetSectionIndices?: readonly number[] | null,
): Promise<{ ok: true; req: SiteChatClaudeRequest } | { ok: false; error: string }> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: `ANTHROPIC_API_KEY ontbreekt in de omgeving. ${ANTHROPIC_KEY_MISSING_USER_HINT}`,
    };
  }

  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic({ apiKey });

  const legacy = config != null && isLegacyTailwindPageConfig(config);
  const scopedIndices = resolveSiteChatTargetIndices(messages, sections, explicitTargetSectionIndices);
  const currentPayload = buildChatPayloadForModel(sections, config, scopedIndices);
  const { systemText: knowledge, userPrefixBlocks } = await getKnowledgeContextForClaude();
  const chatSystemPrompt = buildChatSystemPrompt(legacy, studioModuleFlags);
  const systemBlocks: TextBlockParam[] = [];
  if (knowledge) {
    systemBlocks.push({ type: "text", text: knowledge, cache_control: { type: "ephemeral" } });
  }
  systemBlocks.push({ type: "text", text: chatSystemPrompt, cache_control: { type: "ephemeral" } });
  const claudeMessages = buildClaudeMessages(
    messages,
    currentPayload,
    scopedIndices,
    attachmentUrls,
    userPrefixBlocks,
  );

  return {
    ok: true,
    req: { client, model, system: systemBlocks, messages: claudeMessages, sections, config, allowedSectionIndices: scopedIndices },
  };
}

export async function siteChatWithClaude(
  messages: SiteChatTurn[],
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  attachmentUrls: string[],
  studioModuleFlags?: SiteChatStudioModuleFlags,
  heroPostProcess?: SiteChatHeroPostProcessContext,
  explicitTargetSectionIndices?: readonly number[] | null,
): Promise<SiteChatResult> {
  const built = await buildSiteChatClaudeRequest(
    messages,
    sections,
    config,
    attachmentUrls,
    studioModuleFlags,
    explicitTargetSectionIndices,
  );
  if (!built.ok) {
    return { ok: false, error: built.error };
  }
  const {
    client,
    model,
    system,
    messages: claudeMessages,
    sections: secs,
    config: cfg,
    allowedSectionIndices,
  } = built.req;

  const message = await client.messages.create({
    model,
    max_tokens: clampMaxTokensNonStreaming(model, 24_576),
    system,
    messages: claudeMessages,
  });

  await logClaudeMessageUsage("site_chat", model, message.usage);

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { ok: false, error: "Geen tekst-antwoord van Claude ontvangen." };
  }

  const parsed = processSiteChatFromModelText(textBlock.text, secs, cfg, message.stop_reason, allowedSectionIndices);
  return finalizeSiteChatWithAiHeroPipeline(secs, parsed, messages, heroPostProcess);
}

export type SiteChatStreamNdjsonEvent =
  | { type: "status"; message: string }
  | { type: "reply_preview"; text: string }
  | {
      type: "complete";
      data: {
        reply: string;
        sections?: TailwindSection[];
        config: TailwindPageConfig | null;
      };
    }
  | { type: "error"; message: string; rawText?: string };

export type CreateSiteChatReadableStreamOptions = {
  /** Na succesvol parsen; o.a. voor activity-journal (mag falen zonder de stream te breken). */
  onSuccess?: (data: {
    reply: string;
    sections?: TailwindSection[];
    config: TailwindPageConfig | null | undefined;
  }) => Promise<void>;
  /** Optioneel: `businessName` + slug voor AI-hero (Gemini/OpenAI). Stock-URL-strip gebeurt altijd zonder dit. */
  heroPostProcess?: SiteChatHeroPostProcessContext;
  /** Overschrijft inferentie uit het laatste gebruikersbericht (zelfde semantiek als `/api/ai-edit-site`). */
  explicitTargetSectionIndices?: readonly number[] | null;
};

/**
 * NDJSON-stream: status + `reply_preview` (tekst uit het JSON-antwoord) + `complete` of `error`.
 */
export function createSiteChatReadableStream(
  messages: SiteChatTurn[],
  sections: TailwindSection[],
  config: TailwindPageConfig | null | undefined,
  attachmentUrls: string[],
  studioModuleFlags?: SiteChatStudioModuleFlags,
  streamOptions?: CreateSiteChatReadableStreamOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: SiteChatStreamNdjsonEvent) => {
    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  return new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: "status", message: "Je verzoek wordt verstuurd naar Claude…" });

        const built = await buildSiteChatClaudeRequest(
          messages,
          sections,
          config,
          attachmentUrls,
          studioModuleFlags,
          streamOptions?.explicitTargetSectionIndices,
        );
        if (!built.ok) {
          send(controller, { type: "error", message: built.error });
          controller.close();
          return;
        }

        const {
          client,
          model,
          system,
          messages: claudeMessages,
          sections: secs,
          config: cfg,
          allowedSectionIndices,
        } = built.req;

        send(controller, { type: "status", message: "Claude werkt aan je antwoord — even geduld." });

        const stream = client.messages.stream({
          model,
          max_tokens: clampMaxTokensNonStreaming(model, 24_576),
          system,
          messages: claudeMessages,
        });

        let fullText = "";
        let lastPreview = "";

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            const preview = extractPartialReplyFromStreamingSiteChatJson(fullText);
            if (preview !== lastPreview) {
              lastPreview = preview;
              send(controller, { type: "reply_preview", text: preview });
            }
          }
        }

        const finalMessage = await stream.finalMessage();
        await logClaudeMessageUsage("site_chat", model, finalMessage.usage);

        const textBlock = finalMessage.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          send(controller, { type: "error", message: "Geen tekst-antwoord van Claude ontvangen." });
          controller.close();
          return;
        }

        const parsed = processSiteChatFromModelText(
          textBlock.text,
          secs,
          cfg,
          finalMessage.stop_reason,
          allowedSectionIndices,
        );
        if (!parsed.ok) {
          send(controller, { type: "error", message: parsed.error, rawText: parsed.rawText });
          controller.close();
          return;
        }

        const finalized = await finalizeSiteChatWithAiHeroPipeline(
          secs,
          parsed,
          messages,
          streamOptions?.heroPostProcess,
        );
        if (!finalized.ok) {
          send(controller, { type: "error", message: finalized.error, rawText: finalized.rawText });
          controller.close();
          return;
        }

        if (streamOptions?.onSuccess) {
          try {
            await streamOptions.onSuccess({
              reply: finalized.reply,
              sections: finalized.sections,
              config: finalized.config ?? null,
            });
          } catch {
            /* journal of logging mag de chat niet breken */
          }
        }

        send(controller, {
          type: "complete",
          data: {
            reply: finalized.reply,
            sections: finalized.sections,
            config: finalized.config ?? null,
          },
        });
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : "Claude-streaming mislukt.";
        try {
          send(controller, { type: "error", message });
        } catch {
          /* stream gesloten */
        }
        try {
          controller.close();
        } catch {
          /* */
        }
      }
    },
  });
}
