/**
 * Chunked site-generatie: config + **landingspagina in één batch** + marketing-subpagina’s per call,
 * server-side merge, daarna dezelfde finalisatie als de monolithische stream.
 *
 * Geen job-poll: de client roept sequentieel `…/advance` aan tot `complete`.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { streamClaudeMessageText } from "@/lib/ai/claude-stream-text";
import { parseModelJsonObject } from "@/lib/ai/extract-json";
import {
  postProcessClaudeTailwindMarketingSite,
  postProcessClaudeTailwindPage,
  normalizeClaudeSectionArraysInParsedJson,
  ensureClaudeMarketingSiteJsonHasContactSections,
} from "@/lib/ai/generate-site-postprocess";
import {
  buildClaudeTailwindMarketingSiteOutputSchema,
  claudeTailwindSectionRowSchema,
  mapClaudeMarketingSiteOutputToSections,
  mapClaudeOutputToSections,
  masterPromptPageConfigSchema,
  slugifyToSectionId,
  type GeneratedTailwindPage,
  type MasterPromptPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import {
  buildPhase2InputFromCheckpoint,
  buildSiteGenerationCheckpointPhase1,
  type SiteGenerationJobCheckpointV1,
  type SiteGenerationPhase1JobMeta,
} from "@/lib/ai/site-generation-phased-job";
import type { GenerateSitePromptOptions } from "@/lib/ai/generate-site-with-claude";
import {
  briefingDemandsLightSurfacesPriority,
  buildBriefingLightSurfacesMandateMarkdown,
  withContentClaimDiagnostics,
  type GenerationPipelineFeedback,
} from "@/lib/ai/generate-site-with-claude";
import { applySelfReviewToGeneratedPage, isSiteSelfReviewEnabled } from "@/lib/ai/self-review-site-generation";
import { applyAiHeroImageToGeneratedPage } from "@/lib/ai/ai-hero-image-postprocess";
import { maybeEnhanceHero } from "@/lib/ai/enhance-hero-section";
import { finalizeBookingShopAfterAiGeneration } from "@/lib/site/append-booking-section-to-payload";
import { validateStrictLandingPageContract } from "@/lib/ai/validate-strict-landing-page";
import { stripUnsplashUrlsFromGeneratedTailwindPage } from "@/lib/ai/strip-unsplash-urls";
import { logClaudeMessageUsage } from "@/lib/ai/log-claude-message-usage";
import type { MessageDeltaUsage } from "@anthropic-ai/sdk/resources/messages/messages";
import { marketingPageNavLabel } from "@/lib/ai/marketing-page-slugs";
const USER_CONTEXT_MAX_CHARS = 48_000;
const CONFIG_MAX_TOKENS = 12_000;
const SECTION_MAX_TOKENS = 36_000;
const MARKETING_MAX_TOKENS = 32_000;
const CONTACT_MAX_TOKENS = 32_000;

const configChunkSchema = z.object({ config: masterPromptPageConfigSchema });
const landingBatchChunkSchema = z.object({
  sections: z.array(claudeTailwindSectionRowSchema).min(1).max(8),
});
const marketingSectionsChunkSchema = z.object({
  sections: z.array(claudeTailwindSectionRowSchema).min(1).max(6),
});
const contactChunkSchema = z.object({
  contactSections: z.array(claudeTailwindSectionRowSchema).min(1).max(6),
});

export type ChunkSessionStepState =
  | { phase: "await_config" }
  | { phase: "landing"; index: number }
  | { phase: "marketing"; index: number }
  | { phase: "contact" }
  | { phase: "finalize" }
  | { phase: "done" };

export type ChunkSessionPayloadV1 = {
  v: 1;
  checkpoint: SiteGenerationJobCheckpointV1;
  meta: SiteGenerationPhase1JobMeta;
  step: ChunkSessionStepState;
  useMarketingMultiPage: boolean;
  marketingSlugs: string[];
  landingIds: string[];
  config: MasterPromptPageConfig | null;
  sections: TailwindSection[];
  marketingPages: Record<string, TailwindSection[]>;
  contactSections: TailwindSection[];
};

function stringifyUserContent(uc: string | ContentBlockParam[]): string {
  if (typeof uc === "string") return uc;
  return uc
    .map((b) => {
      if (b.type === "text" && "text" in b && typeof (b as { text?: string }).text === "string") {
        return (b as { text: string }).text;
      }
      return "";
    })
    .join("\n\n");
}

function sliceUserContext(checkpoint: SiteGenerationJobCheckpointV1): string {
  const full = stringifyUserContent(checkpoint.userContentWithComposition);
  if (full.length <= USER_CONTEXT_MAX_CHARS) return full;
  return `${full.slice(0, USER_CONTEXT_MAX_CHARS)}\n\n[… briefing ingekort voor deze sub-call …]`;
}

function rowsToTailwind(rows: z.infer<typeof claudeTailwindSectionRowSchema>[], startIndex: number): TailwindSection[] {
  return rows.map((s, j) => ({
    id: slugifyToSectionId(s.id, startIndex + j),
    sectionName: s.name?.trim() || s.id,
    html: s.html,
  }));
}

async function collectClaudeText(
  client: Anthropic,
  input: { model: string; max_tokens: number; system: string; userText: string },
): Promise<{ text: string; stop_reason: string | null; usage: MessageDeltaUsage | null }> {
  let text = "";
  let stop_reason: string | null = null;
  let usage: MessageDeltaUsage | null = null;
  for await (const ev of streamClaudeMessageText(client, {
    model: input.model,
    max_tokens: input.max_tokens,
    system: input.system,
    userContent: input.userText,
  })) {
    if (ev.type === "delta") text += ev.text;
    else {
      stop_reason = ev.stop_reason;
      usage = ev.usage;
    }
  }
  return { text, stop_reason, usage };
}

async function logUsage(
  model: string,
  usage: MessageDeltaUsage | null,
): Promise<void> {
  if (!usage) return;
  await logClaudeMessageUsage("generate_site", model, {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens,
    cache_read_input_tokens: usage.cache_read_input_tokens,
  });
}

function parseChunkJson(text: string, stop_reason: string | null, label: string): unknown {
  const parsed = parseModelJsonObject(text);
  if (!parsed.ok) {
    throw new Error(
      `${label}: geen geldige JSON.${stop_reason === "max_tokens" ? " Mogelijk outputlimiet — probeer opnieuw." : ""}`,
    );
  }
  return parsed.value;
}

export async function beginChunkedSiteGeneration(params: {
  businessName: string;
  description: string;
  recentClientNames: string[];
  promptOptions?: GenerateSitePromptOptions;
}): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      payload: ChunkSessionPayloadV1;
      feedback: GenerationPipelineFeedback;
      meta: SiteGenerationPhase1JobMeta;
    }
> {
  if (params.promptOptions?.preserveLayoutUpgrade) {
    return { ok: false, error: "Chunked-generatie is niet beschikbaar in layout-upgrade-modus." };
  }

  const phase1 = await buildSiteGenerationCheckpointPhase1({
    businessName: params.businessName,
    description: params.description,
    recentClientNames: params.recentClientNames,
    promptOptions: params.promptOptions,
  });
  if (!phase1.ok) {
    return { ok: false, error: phase1.error };
  }

  const phase2Input = buildPhase2InputFromCheckpoint(phase1.checkpoint);
  const p = phase2Input.prepared;
  const marketingSlugs = p.useMarketingMultiPage && p.marketingPageSlugs?.length ? [...p.marketingPageSlugs] : [];
  const landingIds = p.homepagePlan.sectionSequence.map((s) => s.id);

  const payload: ChunkSessionPayloadV1 = {
    v: 1,
    checkpoint: phase1.checkpoint,
    meta: phase1.meta,
    step: { phase: "await_config" },
    useMarketingMultiPage: p.useMarketingMultiPage,
    marketingSlugs,
    landingIds,
    config: null,
    sections: [],
    marketingPages: {},
    contactSections: [],
  };

  return { ok: true, payload, feedback: p.pipelineFeedback, meta: phase1.meta };
}

export type AdvanceChunkedSessionResult =
  | {
      ok: true;
      complete: false;
      message: string;
      phase: ChunkSessionStepState["phase"];
      landingIndex?: number;
      landingTotal?: number;
      marketingIndex?: number;
      marketingTotal?: number;
      streamingPreview?: { sections: TailwindSection[]; config: MasterPromptPageConfig | null };
    }
  | { ok: true; complete: true; data: GeneratedTailwindPage }
  | { ok: false; error: string };

function payloadFromJson(raw: unknown): ChunkSessionPayloadV1 {
  if (!raw || typeof raw !== "object") throw new Error("Ongeldige sessie-payload.");
  const o = raw as ChunkSessionPayloadV1;
  if (o.v !== 1 || !o.checkpoint) throw new Error("Ongeldige sessie-versie.");
  return o;
}

export async function advanceChunkedSiteGenerationSession(sessionPayload: ChunkSessionPayloadV1): Promise<{
  nextPayload: ChunkSessionPayloadV1;
  result: AdvanceChunkedSessionResult;
}> {
  const checkpoint = sessionPayload.checkpoint;
  const phase2Input = buildPhase2InputFromCheckpoint(checkpoint);
  const p = phase2Input.prepared;
  const client = p.client;
  const model = p.generateModel;
  const system = p.system ?? "";
  const ctx = sliceUserContext(checkpoint);
  const { businessName, description, designContract, promptOptions } = phase2Input;
  const lightPaletteChunk =
    briefingDemandsLightSurfacesPriority(description)
      ? `\n\n${buildBriefingLightSurfacesMandateMarkdown(description)}`
      : "";

  const next: ChunkSessionPayloadV1 = { ...sessionPayload };

  const runConfig = async (): Promise<AdvanceChunkedSessionResult> => {
    const userText = `Je bent de studio site-generator (zelfde regels als de volledige opdracht hieronder).

=== TAAK ===
Lever **uitsluitend** geldige JSON met precies één top-level key: \`config\`, met \`style\`, \`font\` en volledig \`theme\` (primary, primaryLight, primaryMain, primaryDark, accent).
Geen markdown-fences. Geen \`sections\`.

=== CONTEXT (ingekort mogelijk) ===
${ctx}${lightPaletteChunk}`;

    const { text, stop_reason, usage } = await collectClaudeText(client, {
      model,
      max_tokens: CONFIG_MAX_TOKENS,
      system,
      userText,
    });
    await logUsage(model, usage);
    const value = parseChunkJson(text, stop_reason, "config");
    const parsed = configChunkSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, error: `Config-schema: ${parsed.error.message}` };
    }
    next.config = parsed.data.config;
    next.step = { phase: "landing", index: 0 };
    return {
      ok: true,
      complete: false,
      message: "Thema en config vastgelegd — landingspagina-secties volgen.",
      phase: "landing",
      landingIndex: 0,
      landingTotal: next.landingIds.length,
      streamingPreview: { sections: next.sections, config: next.config },
    };
  };

  /** Eén Claude-call voor alle landingssecties: minder round-trips dan per-sectie. */
  const runLandingAll = async (): Promise<AdvanceChunkedSessionResult> => {
    if (!next.config) return { ok: false, error: "Intern: config ontbreekt." };
    const ids = next.landingIds;
    if (ids.length === 0) return { ok: false, error: "Intern: geen landingssectie-id’s." };

    const idsLine = ids.map((id) => `"${id}"`).join(", ");
    const userText = `Je bent de studio site-generator.

=== TAAK ===
Lever **uitsluitend** JSON van de vorm:
{"sections":[ … ]}
Met **exact ${ids.length}** object(en) in \`sections\`, in **deze volgorde** met **exact** deze \`id\`'s (na normalisatie hetzelfde id gebruiken): ${idsLine}.
Elk object: \`id\`, \`name\`, \`html\`. Gebruik het **zelfde** visuele/thema-palet als deze \`config.theme\`:
${JSON.stringify(next.config.theme).slice(0, 1200)}

=== MASTER-CONTEXT (ingekort) ===
${ctx}${lightPaletteChunk}`;

    const { text, stop_reason, usage } = await collectClaudeText(client, {
      model,
      max_tokens: SECTION_MAX_TOKENS,
      system,
      userText,
    });
    await logUsage(model, usage);
    const value = parseChunkJson(text, stop_reason, "landingspagina (batch)");
    const parsed = landingBatchChunkSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, error: `Landingspagina: ${parsed.error.message}` };
    }
    const rows = parsed.data.sections;
    if (rows.length !== ids.length) {
      return {
        ok: false,
        error: `Landingspagina: verwacht ${ids.length} sectie(s), model gaf ${rows.length}.`,
      };
    }
    for (let i = 0; i < ids.length; i++) {
      const want = ids[i]!.trim().toLowerCase();
      const got = rows[i]?.id?.trim().toLowerCase() ?? "";
      if (got !== want) {
        return {
          ok: false,
          error: `Landingspagina: id op index ${i} moet "${ids[i]}" zijn, model gaf "${rows[i]?.id ?? "(leeg)"}".`,
        };
      }
    }
    next.sections = rowsToTailwind(rows, 0);

    if (next.useMarketingMultiPage && next.marketingSlugs.length > 0) {
      next.step = { phase: "marketing", index: 0 };
      return {
        ok: true,
        complete: false,
        message: "Landingspagina compleet — marketingpagina’s volgen.",
        phase: "marketing",
        marketingIndex: 0,
        marketingTotal: next.marketingSlugs.length,
        streamingPreview: { sections: next.sections, config: next.config },
      };
    }

    if (next.useMarketingMultiPage) {
      next.step = { phase: "contact" };
      return {
        ok: true,
        complete: false,
        message: "Landingspagina compleet — contactpagina volgt.",
        phase: "contact",
        streamingPreview: { sections: next.sections, config: next.config },
      };
    }

    next.step = { phase: "finalize" };
    return {
      ok: true,
      complete: false,
      message: "Landingspagina compleet — afronden…",
      phase: "finalize",
      streamingPreview: { sections: next.sections, config: next.config },
    };
  };

  const runMarketingOne = async (slugIndex: number): Promise<AdvanceChunkedSessionResult> => {
    if (!next.config) return { ok: false, error: "Intern: config ontbreekt." };
    const slug = next.marketingSlugs[slugIndex];
    if (!slug) return { ok: false, error: "Intern: onbekende marketing-index." };

    const pageTitle = marketingPageNavLabel(slug);
    const otherSlugs = next.marketingSlugs.filter((s) => s !== slug);
    const crossLinks = [
      `- Start / home: href="__STUDIO_SITE_BASE__" (of \`/\` binnen de site-shell)`,
      ...otherSlugs.map(
        (s) =>
          `- ${marketingPageNavLabel(s)}: href="__STUDIO_SITE_BASE__/${s}"`,
      ),
      `- Contact: href="__STUDIO_CONTACT_PATH__"`,
    ].join("\n");

    const userText = `Je bent de studio site-generator (multipage).

=== TAAK — SUBPAGINA "${slug}" (${pageTitle}) ===
Je bouwt **alleen** inhoud voor **deze ene route**: \`__STUDIO_SITE_BASE__/${slug}\` (${pageTitle}).
Lever **uitsluitend** JSON:
{"sections":[ … ]}
waar \`sections\` een **array** is met **1–4** sectie-objecten. Elk object: \`id\`, \`name\`, \`html\`.

**VERBOD (kwaliteit):** Herhaal **niet** de landingspagina als tweede homepage. Plak **geen** volledige hero-/stats-/features-/footer-blokken van de homepage opnieuw als “deze pagina”. De homepage staat al in \`sections\` op de server — deze JSON is **alleen** voor "${slug}" met **eigen** copy en opbouw (FAQ-vragen op /faq, team/verhaal op /over-ons, enz.).

**WEL:** Zelfde merk-**thema** en typografie als hieronder (\`config.theme\`). Eén duidelijke **site-nav** (zelfde links als op de homepage) mag — maar de **hoofdinhoud** moet uniek zijn voor ${pageTitle}.

=== THEMA (consistentie) ===
${JSON.stringify(next.config.theme).slice(0, 1200)}

=== CROSS-PAGINA-LINKS (alleen href’s — geen homepage-HTML kopiëren) ===
${crossLinks}

=== CONTEXT (briefing, ingekort) ===
${ctx}${lightPaletteChunk}`;

    const { text, stop_reason, usage } = await collectClaudeText(client, {
      model,
      max_tokens: MARKETING_MAX_TOKENS,
      system,
      userText,
    });
    await logUsage(model, usage);
    const value = parseChunkJson(text, stop_reason, `marketing ${slug}`);
    const parsed = marketingSectionsChunkSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, error: `Marketing ${slug}: ${parsed.error.message}` };
    }
    const mapped = rowsToTailwind(parsed.data.sections, slugIndex * 10);
    next.marketingPages[slug] = mapped;

    const last = slugIndex >= next.marketingSlugs.length - 1;
    if (!last) {
      next.step = { phase: "marketing", index: slugIndex + 1 };
      return {
        ok: true,
        complete: false,
        message: `Marketingpagina “${slug}” klaar.`,
        phase: "marketing",
        marketingIndex: slugIndex + 1,
        marketingTotal: next.marketingSlugs.length,
        streamingPreview: { sections: next.sections, config: next.config },
      };
    }

    next.step = { phase: "contact" };
    return {
      ok: true,
      complete: false,
      message: "Marketingpagina’s compleet — contactpagina volgt.",
      phase: "contact",
      streamingPreview: { sections: next.sections, config: next.config },
    };
  };

  const runContact = async (): Promise<AdvanceChunkedSessionResult> => {
    if (!next.config) return { ok: false, error: "Intern: config ontbreekt." };
    if (!next.useMarketingMultiPage) {
      next.step = { phase: "finalize" };
      return {
        ok: true,
        complete: false,
        message: "Afronden…",
        phase: "finalize",
        streamingPreview: { sections: next.sections, config: next.config },
      };
    }

    const userText = `Je bent de studio site-generator.

=== TAAK ===
Lever **uitsluitend** JSON:
{"contactSections":[ … ]}
Minstens één sectie met een **werkend** contactformulier (velden + submit). Gebruik \`__STUDIO_CONTACT_PATH__\` in links van andere pagina’s is al geregeld; focus op contactroute-HTML.
Zelfde \`config.theme\` als landingspagina.

=== CONTEXT ===
${ctx}${lightPaletteChunk}`;

    const { text, stop_reason, usage } = await collectClaudeText(client, {
      model,
      max_tokens: CONTACT_MAX_TOKENS,
      system,
      userText,
    });
    await logUsage(model, usage);
    const value = parseChunkJson(text, stop_reason, "contact");
    const parsed = contactChunkSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, error: `Contact: ${parsed.error.message}` };
    }
    next.contactSections = rowsToTailwind(parsed.data.contactSections, 0);
    next.step = { phase: "finalize" };
    return {
      ok: true,
      complete: false,
      message: "Contactpagina klaar — samenvoegen en controleren…",
      phase: "finalize",
      streamingPreview: { sections: next.sections, config: next.config },
    };
  };

  const runFinalize = async (): Promise<AdvanceChunkedSessionResult> => {
    if (!next.config) return { ok: false, error: "Intern: config ontbreekt vóór finalize." };

    let claudePage: {
      config: MasterPromptPageConfig;
      sections: z.infer<typeof claudeTailwindSectionRowSchema>[];
      marketingPages?: Record<string, z.infer<typeof claudeTailwindSectionRowSchema>[]>;
      contactSections?: z.infer<typeof claudeTailwindSectionRowSchema>[];
    };

    if (next.useMarketingMultiPage) {
      const marketingPages: Record<string, z.infer<typeof claudeTailwindSectionRowSchema>[]> = {};
      for (const slug of next.marketingSlugs) {
        marketingPages[slug] = (next.marketingPages[slug] ?? []).map((s, j) => ({
          id: s.id?.trim() || slugifyToSectionId(s.sectionName, j),
          html: s.html,
          name: s.sectionName,
        }));
      }
      claudePage = {
        config: next.config,
        sections: next.sections.map((s, i) => ({
          id: s.id?.trim() || slugifyToSectionId(s.sectionName, i),
          html: s.html,
          name: s.sectionName,
        })),
        marketingPages,
        contactSections: next.contactSections.map((s, i) => ({
          id: s.id?.trim() || slugifyToSectionId(s.sectionName, i),
          html: s.html,
          name: s.sectionName,
        })),
      };
    } else {
      claudePage = {
        config: next.config,
        sections: next.sections.map((s, i) => ({
          id: s.id?.trim() || slugifyToSectionId(s.sectionName, i),
          html: s.html,
          name: s.sectionName,
        })),
      };
    }

    let normalized: unknown = normalizeClaudeSectionArraysInParsedJson(claudePage);
    if (next.useMarketingMultiPage && next.marketingSlugs.length > 0) {
      normalized = ensureClaudeMarketingSiteJsonHasContactSections(
        normalized as Record<string, unknown>,
        next.marketingSlugs,
      );
    }

    if (next.useMarketingMultiPage && next.marketingSlugs.length > 0) {
      const schema = buildClaudeTailwindMarketingSiteOutputSchema(next.marketingSlugs);
      const validated = schema.safeParse(normalized);
      if (!validated.success) {
        return { ok: false, error: `Samenvoegen: ${validated.error.message}` };
      }
      let processed = postProcessClaudeTailwindMarketingSite(validated.data);
      let mapped = mapClaudeMarketingSiteOutputToSections(processed);
      let data: GeneratedTailwindPage = {
        config: mapped.config,
        sections: mapped.sections,
        contactSections: mapped.contactSections,
        ...(mapped.marketingPages ? { marketingPages: mapped.marketingPages } : {}),
      };
      data = withContentClaimDiagnostics(data);
      if (isSiteSelfReviewEnabled()) {
        const reviewed = await applySelfReviewToGeneratedPage({
          client: p.client,
          model: p.supportModel,
          businessName,
          description,
          draft: data,
          homepagePlan: p.homepagePlan,
          preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
          pipelineInterpreted: p.pipelineFeedback.interpreted,
          designContract,
          referenceSiteSnapshot: p.referenceSiteSnapshot,
        });
        data = reviewed.data;
      }
      data = stripUnsplashUrlsFromGeneratedTailwindPage(data);
      data = await applyAiHeroImageToGeneratedPage(data, {
        businessName,
        description,
        designContract,
        subfolderSlug: promptOptions?.siteStorageSubfolderSlug ?? null,
        prefetchedHeroB64Promise: Promise.resolve(null),
        prebakedHeroPublicUrl: checkpoint.prebakedHeroPublicUrl ?? null,
      });
      data = { ...data, sections: maybeEnhanceHero(data.sections, data.config, description) };
      data = {
        ...data,
        sections: finalizeBookingShopAfterAiGeneration(data.sections, {
          preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
        }),
      };
      if (p.strictLandingContract) {
        const strictErrs = validateStrictLandingPageContract(data.sections);
        if (strictErrs.length > 0) {
          return { ok: false, error: `Strikte landingspagina: ${strictErrs.join(" ")}` };
        }
      }
      next.step = { phase: "done" };
      return { ok: true, complete: true, data };
    }

    const onePage = z
      .object({
        config: masterPromptPageConfigSchema,
        sections: z.array(claudeTailwindSectionRowSchema).min(1).max(8),
      })
      .safeParse(normalized);
    if (!onePage.success) {
      return { ok: false, error: `One-pager: ${onePage.error.message}` };
    }
    const pp = postProcessClaudeTailwindPage(onePage.data);
    const mapped = mapClaudeOutputToSections(pp);
    let data: GeneratedTailwindPage = { config: mapped.config, sections: mapped.sections };
    data = withContentClaimDiagnostics(data);
    if (isSiteSelfReviewEnabled()) {
      const reviewed = await applySelfReviewToGeneratedPage({
        client: p.client,
        model: p.supportModel,
        businessName,
        description,
        draft: data,
        homepagePlan: p.homepagePlan,
        preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
        pipelineInterpreted: p.pipelineFeedback.interpreted,
        designContract,
        referenceSiteSnapshot: p.referenceSiteSnapshot,
      });
      data = reviewed.data;
    }
    data = stripUnsplashUrlsFromGeneratedTailwindPage(data);
    data = await applyAiHeroImageToGeneratedPage(data, {
      businessName,
      description,
      designContract,
      subfolderSlug: promptOptions?.siteStorageSubfolderSlug ?? null,
      prefetchedHeroB64Promise: Promise.resolve(null),
      prebakedHeroPublicUrl: checkpoint.prebakedHeroPublicUrl ?? null,
    });
    data = { ...data, sections: maybeEnhanceHero(data.sections, data.config, description) };
    data = {
      ...data,
      sections: finalizeBookingShopAfterAiGeneration(data.sections, {
        preserveLayoutUpgrade: Boolean(promptOptions?.preserveLayoutUpgrade),
      }),
    };
    if (p.strictLandingContract) {
      const strictErrs = validateStrictLandingPageContract(data.sections);
      if (strictErrs.length > 0) {
        return { ok: false, error: `Strikte landingspagina: ${strictErrs.join(" ")}` };
      }
    }
    next.step = { phase: "done" };
    return { ok: true, complete: true, data };
  };

  let result: AdvanceChunkedSessionResult;

  switch (next.step.phase) {
    case "await_config":
      result = await runConfig();
      break;
    case "landing":
      result = await runLandingAll();
      break;
    case "marketing":
      result = await runMarketingOne(next.step.index);
      break;
    case "contact":
      result = await runContact();
      break;
    case "finalize":
      result = await runFinalize();
      break;
    case "done":
      return {
        nextPayload: next,
        result: { ok: false, error: "Deze sessie is al afgerond." },
      };
    default:
      result = { ok: false, error: "Onbekende sessiefase." };
  }

  if (!result.ok) {
    return { nextPayload: sessionPayload, result };
  }

  return { nextPayload: next, result };
}

export function parseChunkSessionPayloadFromStorage(raw: unknown): ChunkSessionPayloadV1 {
  return payloadFromJson(raw);
}
