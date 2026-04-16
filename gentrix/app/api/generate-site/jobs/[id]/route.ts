import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import {
  getSiteGenerationJobById,
  markSiteGenerationJobFailed,
  runSiteGenerationJob,
} from "@/lib/data/site-generation-jobs";

/** Zelfde plafond als POST /jobs: kickstart + `after()` moeten lang genoeg mogen voor de volledige pipeline. */
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
        created_at: job.created_at,
        updated_at: job.updated_at,
        started_at: job.started_at,
        completed_at: job.completed_at,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
