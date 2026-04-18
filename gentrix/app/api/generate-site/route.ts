import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { generateSiteWithClaude, type GenerateSitePromptOptions } from "@/lib/ai/generate-site-with-claude";
import {
  buildJournalFactsGenerateSite,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import { generateSiteRequestBodySchema } from "@/lib/api/generate-site-request-schema";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { getRecentClientNamesForPrompt } from "@/lib/data/recent-clients-for-prompt";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { isStudioUndecidedBrandName } from "@/lib/studio/studio-brand-sentinel";
/** Keep in sync with `SITE_GENERATION_JOB_MAX_DURATION_SEC` in `@/lib/config/site-generation-job`. */
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

  try {
    const recentNames = await getRecentClientNamesForPrompt(3);
    let businessName = parsed.data.businessName;
    if (isStudioUndecidedBrandName(businessName)) {
      const inferred = deriveStudioBusinessNameFromBriefing(parsed.data.description);
      if (!isStudioUndecidedBrandName(inferred)) businessName = inferred;
    }
    const referenceStyleUrl = parsed.data.reference_style_url;
    const promptOpts: GenerateSitePromptOptions = {
      ...(parsed.data.clientImages?.length ? { clientImages: parsed.data.clientImages } : {}),
      ...(parsed.data.briefingReferenceImages?.length
        ? { briefingReferenceImages: parsed.data.briefingReferenceImages }
        : {}),
      ...(referenceStyleUrl ? { referenceStyleUrl } : {}),
      ...(parsed.data.marketing_page_slugs?.length ? { marketingPageSlugs: parsed.data.marketing_page_slugs } : {}),
    };
    const hasPromptOpts = Object.keys(promptOpts).length > 0;

    const twResult = await generateSiteWithClaude(
      businessName,
      parsed.data.description,
      recentNames,
      hasPromptOpts ? promptOpts : undefined,
    );
    if (!twResult.ok) {
      return NextResponse.json(
        { ok: false, error: twResult.error, rawText: twResult.rawText },
        { status: 422 },
      );
    }
    await tryAppendClaudeActivityJournal({
      source: "generate_site",
      factsMarkdown: buildJournalFactsGenerateSite({
        businessName,
        description: parsed.data.description,
        generationPackage: STUDIO_GENERATION_PACKAGE,
        preserveLayoutUpgrade: false,
        sectionNames: twResult.data.sections.map((s) => s.sectionName ?? s.id),
        configSummaryLine: `Tailwind theme: primary ${twResult.data.config.theme.primary}, accent ${twResult.data.config.theme.accent}`,
        outputFormat: "tailwind_sections",
      }),
    });
    return NextResponse.json({
      ok: true,
      outputFormat: "tailwind_sections" as const,
      data: twResult.data,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout bij Claude.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
