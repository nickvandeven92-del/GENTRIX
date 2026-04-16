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
    if (process.env.NODE_ENV === "development") {
      console.warn("[site_generation_jobs insert]", error.message);
    }
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
    if (process.env.NODE_ENV === "development") {
      console.warn("[site_generation_jobs claim]", error.message);
    }
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
  }>,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("site_generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error && process.env.NODE_ENV === "development") {
    console.warn("[site_generation_jobs update]", error.message);
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
    reference_style_url?: string;
    landing_page_only?: boolean;
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
  const referenceStyleUrl = req.reference_style_url?.trim();
  const promptOpts: GenerateSitePromptOptions = {
    ...(clientImages.length > 0 ? { clientImages } : {}),
    ...(referenceStyleUrl ? { referenceStyleUrl } : {}),
    ...(req.landing_page_only !== undefined ? { landingPageOnly: req.landing_page_only } : {}),
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

  let lastProgressWrite = 0;
  const onEvent = (ev: GenerateSiteStreamNdjsonEvent) => {
    if (ev.type === "status") {
      const now = Date.now();
      if (now - lastProgressWrite < 2_500) return;
      lastProgressWrite = now;
      void updateJob(jobId, { progress_message: ev.message });
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
