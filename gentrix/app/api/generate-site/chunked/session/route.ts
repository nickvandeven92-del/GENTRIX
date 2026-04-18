import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { generateSiteRequestBodySchema } from "@/lib/api/generate-site-request-schema";
import { beginChunkedSiteGeneration } from "@/lib/ai/generate-site-chunked";
import { insertSiteGenerationChunkSession } from "@/lib/data/site-generation-chunk-sessions";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { isStudioUndecidedBrandName } from "@/lib/studio/studio-brand-sentinel";
import { isValidSubfolderSlug } from "@/lib/slug";
import type { GenerateSitePromptOptions } from "@/lib/ai/generate-site-with-claude";
import { getRecentClientNamesForPrompt } from "@/lib/data/recent-clients-for-prompt";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
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
  let businessName = d.businessName;
  if (isStudioUndecidedBrandName(businessName)) {
    const inferred = deriveStudioBusinessNameFromBriefing(d.description);
    if (!isStudioUndecidedBrandName(inferred)) businessName = inferred;
  }

  const slug = d.subfolder_slug?.trim();
  const promptOpts: GenerateSitePromptOptions = {
    ...(slug && isValidSubfolderSlug(slug) ? { siteStorageSubfolderSlug: slug } : {}),
    ...(d.clientImages?.length ? { clientImages: d.clientImages } : {}),
    ...(d.briefingReferenceImages?.length ? { briefingReferenceImages: d.briefingReferenceImages } : {}),
    ...(d.reference_style_url ? { referenceStyleUrl: d.reference_style_url } : {}),
    ...(d.marketing_page_slugs?.length ? { marketingPageSlugs: d.marketing_page_slugs } : {}),
  };
  const hasPromptOpts = Object.keys(promptOpts).length > 0;

  const recentNames = await getRecentClientNamesForPrompt(3);

  const begun = await beginChunkedSiteGeneration({
    businessName,
    description: d.description,
    recentClientNames: recentNames,
    promptOptions: hasPromptOpts ? promptOpts : undefined,
  });

  if (!begun.ok) {
    return NextResponse.json({ ok: false, error: begun.error }, { status: 422 });
  }

  const sessionId = await insertSiteGenerationChunkSession(JSON.parse(JSON.stringify(begun.payload)) as never);
  if (!sessionId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Kon geen chunked-sessie aanmaken. Controleer migratie `site_generation_chunk_sessions` en Supabase-service-role.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    sessionId,
    feedback: begun.feedback,
    denklijn_text: begun.meta.denklijn_text,
    denklijn_skip_reason: begun.meta.denklijn_skip_reason,
    design_contract_json: begun.meta.design_contract_json,
    design_contract_warning: begun.meta.design_contract_warning,
  });
}
