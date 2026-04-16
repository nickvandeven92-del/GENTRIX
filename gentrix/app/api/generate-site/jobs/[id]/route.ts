import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { getSiteGenerationJobById, runSiteGenerationJob } from "@/lib/data/site-generation-jobs";

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

  // Fallback: als `after()` in de start-route niet afvuurt op de host, kickstart polling de job alsnog.
  if (job.status === "queued") {
    void runSiteGenerationJob(job.id).catch((e) => {
      console.error("[generate-site/jobs/:id kickoff]", job.id, e);
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
