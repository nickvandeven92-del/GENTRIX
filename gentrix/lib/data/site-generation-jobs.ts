import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { consumeGenerateSiteReadableStream } from "@/lib/ai/consume-generate-site-readable-stream";
import {
  createGenerateSiteReadableStream,
  type GenerateSitePromptOptions,
  type GenerateSiteStreamNdjsonEvent,
} from "@/lib/ai/generate-site-with-claude";
import type { GeneratedTailwindPage } from "@/lib/ai/tailwind-sections-schema";
import { getRecentClientNamesForPrompt } from "@/lib/data/recent-clients-for-prompt";
import {
  buildJournalFactsGenerateSite,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { tryLogSiteGenerationRun } from "@/lib/data/log-site-generation-run";
import { isValidSubfolderSlug } from "@/lib/slug";

/** JSON-serializable values for `json`/`jsonb` columns. */
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SiteGenerationJobStatus = "queued" | "running" | "succeeded" | "failed";

export type SiteGenerationJobRow = {
  id: string;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  status: SiteGenerationJobStatus;
  request_json: Record<string, unknown>;
  progress_message: string | null;
  result_json: GeneratedTailwindPage | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  /** `generation_meta` — voor Details / polling i.p.v. NDJSON (na migratie). */
  pipeline_feedback_json?: Json | null;
  denklijn_text?: string | null;
  denklijn_skip_reason?: string | null;
  design_contract_json?: Json | null;
  design_contract_warning?: string | null;
};

export type CreateSiteGenerationJobInput = {
  clientId: string | null;
  requestJson: Record<string, unknown>;
};

export async function insertSiteGenerationJob(input: CreateSiteGenerationJobInput): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("site_generation_jobs")
    .insert({
      client_id: input.clientId,
      status: "queued",
      request_json: input.requestJson,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[site_generation_jobs insert]", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

export async function getSiteGenerationJobById(jobId: string): Promise<SiteGenerationJobRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("site_generation_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error || !data) return null;
  return data as SiteGenerationJobRow;
}

async function claimQueuedSiteGenerationJob(jobId: string): Promise<SiteGenerationJobRow | null> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("site_generation_jobs")
    .update({
      status: "running",
      started_at: now,
      progress_message: "Generatie gestart…",
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[site_generation_jobs claim]", jobId, error.message);
    return null;
  }
  if (!data) return null;
  return data as SiteGenerationJobRow;
}

async function updateJob(
  jobId: string,
  patch: Partial<{
    status: SiteGenerationJobStatus;
    progress_message: string | null;
    result_json: GeneratedTailwindPage | null;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    pipeline_feedback_json: Json | null;
    denklijn_text: string | null;
    denklijn_skip_reason: string | null;
    design_contract_json: Json | null;
    design_contract_warning: string | null;
  }>,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("site_generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) {
    console.warn("[site_generation_jobs update]", jobId, error.message);
  }
}

/**
 * Voert dezelfde pipeline uit als `/api/generate-site/stream`, maar zonder NDJSON naar de client.
 * Roept aan vanuit `after()` op de job-route.
 */
export async function markSiteGenerationJobFailed(jobId: string, message: string): Promise<void> {
  await updateJob(jobId, {
    status: "failed",
    error_message: message.slice(0, 4_000),
    completed_at: new Date().toISOString(),
  });
}

export async function runSiteGenerationJob(jobId: string): Promise<void> {
  const job = await claimQueuedSiteGenerationJob(jobId);
  if (!job) return;

  try {
  const req = job.request_json as {
    businessName?: string;
    description?: string;
    clientImages?: { url: string; label?: string }[];
    briefingReferenceImages?: { url: string; label?: string }[];
    reference_style_url?: string;
    marketing_page_slugs?: string[];
    subfolder_slug?: string;
    generation_preset_ids?: string[];
    layout_archetypes?: string[];
  };

  const businessName = String(req.businessName ?? "").trim();
  const description = String(req.description ?? "").trim();
  if (!businessName || !description) {
    await updateJob(jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: "Ongeldige job: businessName of description ontbreekt.",
    });
    return;
  }

  const recentNames = await getRecentClientNamesForPrompt(3);
  const clientImages = req.clientImages ?? [];
  const briefingReferenceImages = req.briefingReferenceImages ?? [];
  const referenceStyleUrl = req.reference_style_url?.trim();
  const promptOpts: GenerateSitePromptOptions = {
    ...(clientImages.length > 0 ? { clientImages } : {}),
    ...(briefingReferenceImages.length > 0 ? { briefingReferenceImages } : {}),
    ...(referenceStyleUrl ? { referenceStyleUrl } : {}),
    ...(req.marketing_page_slugs?.length ? { marketingPageSlugs: req.marketing_page_slugs } : {}),
  };
  const hasPromptOpts = Object.keys(promptOpts).length > 0;

  const stream = createGenerateSiteReadableStream(
    businessName,
    description,
    recentNames,
    hasPromptOpts ? promptOpts : undefined,
    {
      onSuccess: async (data) => {
        await tryAppendClaudeActivityJournal({
          source: "generate_site",
          factsMarkdown: buildJournalFactsGenerateSite({
            businessName,
            description,
            generationPackage: STUDIO_GENERATION_PACKAGE,
            preserveLayoutUpgrade: false,
            sectionNames: data.sections.map((s) => s.sectionName ?? s.id),
            configSummaryLine: `Tailwind theme: primary ${data.config.theme.primary}, accent ${data.config.theme.accent}`,
            outputFormat: "tailwind_sections",
          }),
        });
        const slug = req.subfolder_slug?.trim();
        if (slug && isValidSubfolderSlug(slug)) {
          await tryLogSiteGenerationRun({
            subfolderSlug: slug,
            operation: "full_generate_job",
            promptExcerpt: `${businessName}\n${description}`,
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
            status: "success",
            outcome: "unknown",
            presetIds: req.generation_preset_ids ?? null,
            layoutArchetypes: req.layout_archetypes ?? null,
            commandChain: ["full_generate_job", "tailwind_sections"],
          });
        }
      },
    },
  );

  /** Alleen voor `type: "status"` uit de stream (niet voor generation_meta/tokens), om snelle status-runs niet weg te smoren. */
  let lastStreamStatusThrottleAt = 0;
  let sectionCount = 0;
  let tokenChars = 0;
  let lastTokenProgressAt = 0;
  let lastKeepaliveProgressAt = 0;

  const writeProgress = (message: string) => {
    const trimmed = message.trim().slice(0, 500);
    if (!trimmed) return;
    void updateJob(jobId, { progress_message: trimmed });
  };

  const onEvent = (ev: GenerateSiteStreamNdjsonEvent) => {
    const now = Date.now();
    if (ev.type === "status") {
      const msgTrim = ev.message.trim();
      const forceProgress =
        msgTrim.includes("Denklijn") ||
        msgTrim.includes("Pagina genereren") ||
        msgTrim.includes("Zelfreview") ||
        msgTrim.includes("Stock:") ||
        msgTrim.includes("Stock ") ||
        msgTrim.includes("Generatie voltooid");
      if (!forceProgress && now - lastStreamStatusThrottleAt < 2_500) return;
      lastStreamStatusThrottleAt = now;
      writeProgress(ev.message);
      return;
    }
    if (ev.type === "generation_meta") {
      const pm = "Briefing geïnterpreteerd (branche, stijl, paginastructuur).";
      void updateJob(jobId, {
        progress_message: pm,
        pipeline_feedback_json: JSON.parse(JSON.stringify(ev.feedback)) as Json,
      });
      return;
    }
    if (ev.type === "design_rationale") {
      const hasText = ev.text != null && ev.text.trim().length > 0;
      const skipShort = ev.skipReason?.trim().slice(0, 160);
      const pm = hasText
        ? `Denklijn ontvangen (${ev.text!.length} tekens); designcontract gekoppeld.`
        : skipShort
          ? `Denklijn overgeslagen: ${skipShort}`
          : "Denklijn overgeslagen of leeg.";
      void updateJob(jobId, {
        progress_message: pm.slice(0, 500),
        denklijn_text: hasText ? ev.text!.slice(0, 500_000) : null,
        denklijn_skip_reason: hasText ? null : (ev.skipReason?.trim().slice(0, 4_000) ?? null),
        design_contract_json: ev.contract ? (JSON.parse(JSON.stringify(ev.contract)) as Json) : null,
        design_contract_warning: ev.contractWarning?.trim().slice(0, 8_000) ?? null,
      });
      return;
    }
    if (ev.type === "keepalive") {
      /** Stream pingt elke 4s tijdens stille stappen; DB iets vaker bijwerken voorkomt “vastgelopen” in de UI. */
      if (now - lastKeepaliveProgressAt < 4_000) return;
      lastKeepaliveProgressAt = now;
      writeProgress("Server werkt nog (langere stap) — even geduld…");
      return;
    }
    if (ev.type === "section_complete") {
      sectionCount += 1;
      const label = ev.section.sectionName?.trim() || ev.section.id;
      writeProgress(
        `Sectie in concept: ${label} (${sectionCount} sectie${sectionCount === 1 ? "" : "s"} — HTML uit model-stream; run nog niet af)`,
      );
      return;
    }
    if (ev.type === "token") {
      tokenChars += ev.content.length;
      if (now - lastTokenProgressAt < 12_000) return;
      lastTokenProgressAt = now;
      const kb = Math.max(1, Math.round(tokenChars / 1024));
      writeProgress(
        `Ruwe model-output: ~${kb}k tekens (stukken JSON/HTML; secties met naam verschijnen hieronder)`,
      );
      return;
    }
    if (ev.type === "self_review") {
      writeProgress(
        ev.ran
          ? ev.refined
            ? "Zelfreview toegepast — concept bijgewerkt."
            : "Zelfreview afgerond (geen wijziging)."
          : "Zelfreview overgeslagen.",
      );
      return;
    }
  };

  const result = await consumeGenerateSiteReadableStream(stream, onEvent);

  if (result.ok) {
    await updateJob(jobId, {
      status: "succeeded",
      result_json: result.data,
      progress_message: "Generatie voltooid",
      completed_at: new Date().toISOString(),
    });
    return;
  }

  await updateJob(jobId, {
    status: "failed",
    error_message: result.error,
    progress_message: null,
    completed_at: new Date().toISOString(),
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[runSiteGenerationJob]", jobId, e);
    await markSiteGenerationJobFailed(jobId, msg);
  }
}

export async function resolveClientIdFromSubfolderSlug(subfolderSlug: string): Promise<string | null> {
  const slug = subfolderSlug.trim();
  if (!slug || !isValidSubfolderSlug(slug)) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("clients").select("id").eq("subfolder_slug", slug).maybeSingle();
  if (error && !isPostgrestUnknownColumnError(error, "subfolder_slug")) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveClientIdFromSubfolderSlug]", error.message);
    }
  }
  return data?.id ?? null;
}
