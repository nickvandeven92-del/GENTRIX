import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import {
  getSiteGenerationJobById,
  markSiteGenerationJobFailed,
  runSiteGenerationJob,
} from "@/lib/data/site-generation-jobs";
import { SITE_GENERATION_JOB_MAX_DURATION_SEC } from "@/lib/config/site-generation-job";

/** Zelfde plafond als POST /jobs: kickstart + `after()` moeten lang genoeg mogen voor de volledige pipeline. Literal required for Next segment config static analysis. */
export const maxDuration = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const job = await getSiteGenerationJobById(id);
  if (!job) {
    return NextResponse.json({ ok: false, error: "Job niet gevonden." }, { status: 404 });
  }

  // Fallback: als `after()` op POST niet afvuurt, start de job alsnog. Gebruik `after()` i.p.v. `void`:
  // bij een korte GET eindigt de serverless-invocation zodra het JSON-antwoord klaar is — dan breekt
  // `void runSiteGenerationJob()` op Vercel vaak af vóór de generatie klaar is.
  if (job.status === "queued") {
    after(() => {
      runSiteGenerationJob(job.id).catch(async (e) => {
        console.error("[generate-site/jobs/:id kickoff]", job.id, e);
        await markSiteGenerationJobFailed(job.id, e instanceof Error ? e.message : String(e));
      });
    });
  }

  return NextResponse.json(
    {
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        progress_message: job.progress_message,
        error_message: job.error_message,
        result: job.result_json,
        pipeline_feedback_json: job.pipeline_feedback_json ?? null,
        denklijn_text: job.denklijn_text ?? null,
        denklijn_skip_reason: job.denklijn_skip_reason ?? null,
        design_contract_json: job.design_contract_json ?? null,
        design_contract_warning: job.design_contract_warning ?? null,
        created_at: job.created_at,
        updated_at: job.updated_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
        /** Browser: wall-clock vanaf `started_at` i.p.v. `updated_at` (keepalives verversen die laatste). */
        server_max_duration_sec: SITE_GENERATION_JOB_MAX_DURATION_SEC,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
