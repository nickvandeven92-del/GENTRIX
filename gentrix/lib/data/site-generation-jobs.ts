import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { consumeGenerateSiteReadableStream } from "@/lib/ai/consume-generate-site-readable-stream";
import {
  buildSiteGenerationCheckpointPhase1,
  executeSiteGenerationFromCheckpoint,
  parseSiteGenerationJobCheckpoint,
} from "@/lib/ai/site-generation-phased-job";
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
import { resolveGenerateSiteModuleFlags } from "@/lib/api/resolve-generate-site-module-flags";
import { tryLogSiteGenerationRun } from "@/lib/data/log-site-generation-run";
import { isValidSubfolderSlug, STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { isStudioUndecidedBrandName } from "@/lib/studio/studio-brand-sentinel";

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
  generation_checkpoint?: Json | null;
  /** `single` | `awaiting_continue` | `running_continue` — gefaseerde job (checkpoint + tweede invocatie). */
  generation_split_phase?: string | null;
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
    generation_checkpoint: Json | null;
    generation_split_phase: string | null;
  }>,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("site_generation_jobs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) {
    console.error("[site_generation_jobs update]", jobId, error.message);
    return false;
  }
  return true;
}

/**
 * Voert dezelfde pipeline uit als `/api/generate-site/stream`, maar zonder NDJSON naar de client.
 * Roept aan vanuit `after()` op de job-route.
 */
export async function markSiteGenerationJobFailed(jobId: string, message: string): Promise<void> {
  const ok = await updateJob(jobId, {
    status: "failed",
    error_message: message.slice(0, 4_000),
    completed_at: new Date().toISOString(),
    generation_checkpoint: null,
    generation_split_phase: "single",
  });
  if (!ok) {
    console.error("[site_generation_jobs] markSiteGenerationJobFailed: update mislukte", jobId);
  }
}

function isPhasedSiteGenerationJobsEnabled(): boolean {
  return process.env.SITE_GENERATION_PHASED_JOB === "1";
}

async function runJobOnSuccessSideEffects(
  businessName: string,
  description: string,
  slugForStorage: string | undefined,
  req: { generation_preset_ids?: string[]; layout_archetypes?: string[] },
  data: GeneratedTailwindPage,
): Promise<void> {
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
  if (slugForStorage && isValidSubfolderSlug(slugForStorage)) {
    await tryLogSiteGenerationRun({
      subfolderSlug: slugForStorage,
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
}

async function claimAwaitingContinueSiteGenerationJob(jobId: string): Promise<SiteGenerationJobRow | null> {
  const supabase = createServiceRoleClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("site_generation_jobs")
    .update({
      generation_split_phase: "running_continue",
      progress_message: "Pagina genereren (HTML/JSON) — tweede server-ronde…",
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("generation_split_phase", "awaiting_continue")
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[site_generation_jobs claim_continue]", jobId, error.message);
    return null;
  }
  if (!data) return null;
  return data as SiteGenerationJobRow;
}

/**
 * Tweede fase: laadt checkpoint uit DB, claimt `awaiting_continue`, draait hoofdstream + post (zelfde logica als monolith).
 * Aanroep: interne `POST …/jobs/{id}/continue` of fallback in-process vanuit fase 1.
 */
export async function runSiteGenerationJobContinuePhase2(jobId: string): Promise<void> {
  const claimed = await claimAwaitingContinueSiteGenerationJob(jobId);
  if (!claimed) {
    const j = await getSiteGenerationJobById(jobId);
    if (j?.status === "succeeded") return;
    if (j?.generation_split_phase === "running_continue") {
      console.warn("[site_generation_jobs continue] Geen claim (niet in awaiting_continue); skip.", jobId);
    }
    return;
  }

  const checkpoint = parseSiteGenerationJobCheckpoint(claimed.generation_checkpoint);
  if (!checkpoint) {
    await markSiteGenerationJobFailed(jobId, "Checkpoint ontbreekt of is ongeldig (schema).");
    return;
  }

  const req = claimed.request_json as {
    subfolder_slug?: string;
    generation_preset_ids?: string[];
    layout_archetypes?: string[];
  };
  const slugForStorage = req.subfolder_slug?.trim();

  let result: Awaited<ReturnType<typeof executeSiteGenerationFromCheckpoint>>;
  try {
    result = await executeSiteGenerationFromCheckpoint(checkpoint);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await markSiteGenerationJobFailed(jobId, msg);
    return;
  }

  if (!result.ok) {
    await markSiteGenerationJobFailed(jobId, result.error);
    return;
  }

  await runJobOnSuccessSideEffects(
    checkpoint.businessName,
    checkpoint.description,
    slugForStorage && isValidSubfolderSlug(slugForStorage) ? slugForStorage : undefined,
    req,
    result.data,
  );

  const saved = await updateJob(jobId, {
    status: "succeeded",
    result_json: result.data,
    progress_message: "Generatie voltooid",
    completed_at: new Date().toISOString(),
    generation_checkpoint: null,
    generation_split_phase: "single",
  });
  if (!saved) {
    await markSiteGenerationJobFailed(
      jobId,
      "Generatie geslaagd maar opslaan in de database mislukte (vaak: JSON te groot voor `result_json`, of DB-timeout). Verklein de briefing/secties of verhoog database-limiet.",
    );
  }
}

async function triggerPhasedSiteJobContinue(jobId: string): Promise<void> {
  const secret = process.env.INTERNAL_SITE_GEN_JOB_CONTINUE_SECRET?.trim();
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!secret || !base) {
    console.warn(
      "[site_generation_jobs] Gefaseerde job: geen INTERNAL_SITE_GEN_JOB_CONTINUE_SECRET en/of publieke basis-URL — fase2 start in-process (zelfde invocation; tijdslimiet niet gereset).",
    );
    try {
      await runSiteGenerationJobContinuePhase2(jobId);
    } catch (e) {
      console.error("[site_generation_jobs] fase2 inline", jobId, e);
      await markSiteGenerationJobFailed(jobId, e instanceof Error ? e.message : String(e));
    }
    return;
  }

  const url = `${base.replace(/\/$/, "")}/api/generate-site/jobs/${jobId}/continue`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[site_generation_jobs] continue HTTP", res.status, t.slice(0, 500));
      try {
        await runSiteGenerationJobContinuePhase2(jobId);
      } catch (e) {
        console.error("[site_generation_jobs] fase2 na HTTP-fout", jobId, e);
        await markSiteGenerationJobFailed(jobId, e instanceof Error ? e.message : String(e));
      }
    }
  } catch (e) {
    console.error("[site_generation_jobs] continue fetch", jobId, e);
    try {
      await runSiteGenerationJobContinuePhase2(jobId);
    } catch (e2) {
      console.error("[site_generation_jobs] fase2 na netwerkfout", jobId, e2);
      await markSiteGenerationJobFailed(jobId, e2 instanceof Error ? e2.message : String(e2));
    }
  }
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
    appointments_enabled?: boolean;
    webshop_enabled?: boolean;
  };

  let businessName = String(req.businessName ?? "").trim();
  const description = String(req.description ?? "").trim();
  if (isStudioUndecidedBrandName(businessName)) {
    const inferred = deriveStudioBusinessNameFromBriefing(description);
    if (!isStudioUndecidedBrandName(inferred)) businessName = inferred;
  }
  if (!businessName || !description) {
    void updateJob(jobId, {
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
  const slugForStorage = req.subfolder_slug?.trim();
  const moduleFlags = await resolveGenerateSiteModuleFlags({
    subfolder_slug: slugForStorage,
    appointments_enabled: req.appointments_enabled,
    webshop_enabled: req.webshop_enabled,
  });
  const promptOpts: GenerateSitePromptOptions = {
    ...(slugForStorage && isValidSubfolderSlug(slugForStorage)
      ? { siteStorageSubfolderSlug: slugForStorage }
      : {}),
    ...(slugForStorage === STUDIO_HOMEPAGE_SUBFOLDER_SLUG ? { gentrixScrollNav: true } : {}),
    ...(clientImages.length > 0 ? { clientImages } : {}),
    ...(briefingReferenceImages.length > 0 ? { briefingReferenceImages } : {}),
    ...(referenceStyleUrl ? { referenceStyleUrl } : {}),
    ...(req.marketing_page_slugs?.length ? { marketingPageSlugs: req.marketing_page_slugs } : {}),
    ...(moduleFlags.appointmentsEnabled ? { appointmentsEnabled: true } : {}),
    ...(moduleFlags.webshopEnabled ? { webshopEnabled: true } : {}),
  };
  const hasPromptOpts = Object.keys(promptOpts).length > 0;

  if (isPhasedSiteGenerationJobsEnabled()) {
    const phase1 = await buildSiteGenerationCheckpointPhase1({
      businessName,
      description,
      recentClientNames: recentNames,
      promptOptions: hasPromptOpts ? promptOpts : undefined,
    });
    if (!phase1.ok) {
      await markSiteGenerationJobFailed(jobId, phase1.error);
      return;
    }
    const ck = JSON.parse(JSON.stringify(phase1.checkpoint)) as Json;
    const persisted = await updateJob(jobId, {
      pipeline_feedback_json: phase1.meta.pipeline_feedback_json as Json,
      denklijn_text: phase1.meta.denklijn_text,
      denklijn_skip_reason: phase1.meta.denklijn_skip_reason,
      design_contract_json: phase1.meta.design_contract_json as Json | null,
      design_contract_warning: phase1.meta.design_contract_warning,
      generation_checkpoint: ck,
      generation_split_phase: "awaiting_continue",
      progress_message:
        "Checkpoint na voorbereiding — HTML/JSON in tweede server-ronde (nieuwe tijdslimiet)…",
    });
    if (!persisted) {
      console.warn("[site_generation_jobs] Checkpoint niet opgeslagen — voltooien in-process.");
      const result = await executeSiteGenerationFromCheckpoint(phase1.checkpoint);
      if (!result.ok) {
        await markSiteGenerationJobFailed(jobId, result.error);
        return;
      }
      await runJobOnSuccessSideEffects(
        businessName,
        description,
        slugForStorage && isValidSubfolderSlug(slugForStorage) ? slugForStorage : undefined,
        req,
        result.data,
      );
      const okSave = await updateJob(jobId, {
        status: "succeeded",
        result_json: result.data,
        progress_message: "Generatie voltooid",
        completed_at: new Date().toISOString(),
        generation_checkpoint: null,
        generation_split_phase: "single",
      });
      if (!okSave) {
        await markSiteGenerationJobFailed(
          jobId,
          "Generatie geslaagd maar opslaan in de database mislukte (vaak: JSON te groot voor `result_json`, of DB-timeout). Verklein de briefing/secties of verhoog database-limiet.",
        );
      }
      return;
    }
    await triggerPhasedSiteJobContinue(jobId);
    return;
  }

  const stream = createGenerateSiteReadableStream(
    businessName,
    description,
    recentNames,
    hasPromptOpts ? promptOpts : undefined,
    {
      onSuccess: async (data) => {
        await runJobOnSuccessSideEffects(
          businessName,
          description,
          slugForStorage && isValidSubfolderSlug(slugForStorage) ? slugForStorage : undefined,
          req,
          data,
        );
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
    if (ev.type === "stream_trace") {
      return;
    }
    if (ev.type === "status") {
      const msgTrim = ev.message.trim();
      const forceProgress =
        msgTrim.includes("Denklijn") ||
        msgTrim.includes("Pagina genereren") ||
        msgTrim.includes("Zelfreview") ||
        msgTrim.includes("Hero:") ||
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
      /** Minder vaak dan de stream-ping (4s): `updated_at` hoort niet elke paar seconden te verversen — dat maskeerde client-side “stale job”-detectie. */
      if (now - lastKeepaliveProgressAt < 20_000) return;
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
      return;
    }
  };

  const result = await consumeGenerateSiteReadableStream(stream, onEvent);

  if (result.ok) {
    const saved = await updateJob(jobId, {
      status: "succeeded",
      result_json: result.data,
      progress_message: "Generatie voltooid",
      completed_at: new Date().toISOString(),
    });
    if (!saved) {
      await markSiteGenerationJobFailed(
        jobId,
        "Generatie geslaagd maar opslaan in de database mislukte (vaak: JSON te groot voor `result_json`, of DB-timeout). Verklein de briefing/secties of verhoog database-limiet.",
      );
    }
    return;
  }

  const failSaved = await updateJob(jobId, {
    status: "failed",
    error_message: result.error,
    progress_message: null,
    completed_at: new Date().toISOString(),
  });
  if (!failSaved) {
    console.error("[runSiteGenerationJob] Kon failed-status niet opslaan", jobId);
  }
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
