import { after } from "next/server";
import { NextResponse } from "next/server";
import {
  markSiteGenerationJobFailed,
  runSiteGenerationJobContinuePhase2,
} from "@/lib/data/site-generation-jobs";

/** Zelfde plafond als fase 1: hoofdstream + zelfreview + hero krijgen een verse wall-clock. */
export const maxDuration = 300;

/**
 * Interne tweede invocatie voor gefaseerde `site_generation_jobs` (`SITE_GENERATION_PHASED_JOB=1`).
 * Beveiligd met `Authorization: Bearer ${INTERNAL_SITE_GEN_JOB_CONTINUE_SECRET}`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const expected = process.env.INTERNAL_SITE_GEN_JOB_CONTINUE_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_SITE_GEN_JOB_CONTINUE_SECRET is niet geconfigureerd." },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Job-id ontbreekt." }, { status: 400 });
  }

  after(() => {
    runSiteGenerationJobContinuePhase2(id).catch(async (e) => {
      console.error("[generate-site/jobs/:id/continue]", id, e);
      await markSiteGenerationJobFailed(id, e instanceof Error ? e.message : String(e));
    });
  });

  return NextResponse.json({ ok: true, accepted: true }, { status: 202 });
}
