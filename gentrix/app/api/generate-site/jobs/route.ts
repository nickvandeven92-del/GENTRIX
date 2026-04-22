import { after } from "next/server";
import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { generateSiteRequestBodySchema } from "@/lib/api/generate-site-request-schema";
import {
  insertSiteGenerationJob,
  markSiteGenerationJobFailed,
  resolveClientIdFromSubfolderSlug,
  runSiteGenerationJob,
} from "@/lib/data/site-generation-jobs";
/**
 * `after()`-work deelt dit plafond met de POST-response.
 * **Hobby:** `maxDuration` max. **300** in deploy — anders 800 op **Pro** (sync met
 * `SITE_GENERATION_JOB_MAX_DURATION_SEC` in `lib/config/site-generation-job.ts`).
 */
export const maxDuration = 800;

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON-body." }, { status: 400 });
  }

  const parsed = generateSiteRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const d = parsed.data;
  let clientId: string | null = null;
  const slug = d.subfolder_slug?.trim();
  if (slug) {
    clientId = await resolveClientIdFromSubfolderSlug(slug);
  }

  const requestJson: Record<string, unknown> = {
    businessName: d.businessName,
    description: d.description,
    ...(d.clientImages?.length ? { clientImages: d.clientImages } : {}),
    ...(d.briefingReferenceImages?.length ? { briefingReferenceImages: d.briefingReferenceImages } : {}),
    ...(d.reference_style_url ? { reference_style_url: d.reference_style_url } : {}),
    ...(slug ? { subfolder_slug: slug } : {}),
    ...(d.generation_preset_ids?.length ? { generation_preset_ids: d.generation_preset_ids } : {}),
    ...(d.layout_archetypes?.length ? { layout_archetypes: d.layout_archetypes } : {}),
    ...(d.appointments_enabled === true ? { appointments_enabled: true } : {}),
    ...(d.webshop_enabled === true ? { webshop_enabled: true } : {}),
  };

  const jobId = await insertSiteGenerationJob({ clientId, requestJson });
  if (!jobId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kon geen generatie-job aanmaken. Controleer of de migratie `site_generation_jobs` op de database is toegepast.",
      },
      { status: 503 },
    );
  }

  after(() => {
    runSiteGenerationJob(jobId).catch(async (e) => {
      console.error("[generate-site/jobs]", jobId, e);
      await markSiteGenerationJobFailed(jobId, e instanceof Error ? e.message : String(e));
    });
  });

  return NextResponse.json({ ok: true, jobId });
}
