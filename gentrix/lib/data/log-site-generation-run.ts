import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type GenerationRunStatus = "success" | "failure" | "partial";
export type GenerationRunOutcome = "kept" | "published" | "abandoned" | "unknown";

export type LogSiteGenerationRunInput = {
  subfolderSlug: string;
  operation: string;
  promptExcerpt: string;
  model?: string | null;
  promptHash?: string | null;
  presetIds?: string[] | null;
  layoutArchetypes?: string[] | null;
  commandChain?: string[] | null;
  status?: GenerationRunStatus | null;
  outcome?: GenerationRunOutcome | null;
  inputSnapshotId?: string | null;
  outputSnapshotId?: string | null;
  /** Metrics / changeReport-samenvatting (JSON in `site_generation_runs.interpretation_json`). */
  interpretation?: Record<string, unknown> | null;
};

export function hashPromptExcerptForRun(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 64);
}

/**
 * Best-effort audit trail; faalt stil als Supabase of tabel nog niet klaar is.
 */
export async function tryLogSiteGenerationRun(input: LogSiteGenerationRunInput): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: client, error: cErr } = await supabase
      .from("clients")
      .select("id, draft_snapshot_id")
      .eq("subfolder_slug", input.subfolderSlug)
      .maybeSingle();

    if (cErr || !client) return;

    const promptHash =
      input.promptHash ??
      (input.promptExcerpt.trim() ? hashPromptExcerptForRun(input.promptExcerpt) : null);

    const { error } = await supabase.from("site_generation_runs").insert({
      client_id: client.id,
      operation: input.operation,
      prompt_excerpt: input.promptExcerpt.slice(0, 2000),
      model: input.model ?? null,
      input_snapshot_id: input.inputSnapshotId ?? client.draft_snapshot_id,
      output_snapshot_id: input.outputSnapshotId ?? null,
      prompt_hash: promptHash,
      preset_ids: input.presetIds?.length ? input.presetIds : null,
      layout_archetypes: input.layoutArchetypes?.length ? input.layoutArchetypes : null,
      command_chain: input.commandChain?.length ? input.commandChain : null,
      status: input.status ?? null,
      outcome: input.outcome ?? null,
      interpretation_json: input.interpretation ?? null,
    });

    if (error && process.env.NODE_ENV === "development") {
      console.warn("[site_generation_runs]", error.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("SUPABASE_SERVICE_ROLE_KEY") && process.env.NODE_ENV === "development") {
      console.warn("[tryLogSiteGenerationRun]", msg);
    }
  }
}

/** Markeer de meest recente run van deze klant (bijv. na expliciete publish). */
export async function tryMarkLatestGenerationRunOutcome(
  clientId: string,
  outcome: GenerationRunOutcome,
): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: run, error: qErr } = await supabase
      .from("site_generation_runs")
      .select("id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (qErr || !run) return;
    const { error } = await supabase.from("site_generation_runs").update({ outcome }).eq("id", run.id);
    if (error && isPostgrestUnknownColumnError(error, "outcome")) return;
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[tryMarkLatestGenerationRunOutcome]", error.message);
    }
  } catch {
    /* ignore */
  }
}
