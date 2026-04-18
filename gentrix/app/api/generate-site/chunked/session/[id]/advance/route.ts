import { NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import {
  advanceChunkedSiteGenerationSession,
  parseChunkSessionPayloadFromStorage,
} from "@/lib/ai/generate-site-chunked";
import {
  deleteSiteGenerationChunkSession,
  getSiteGenerationChunkSession,
  updateSiteGenerationChunkSession,
} from "@/lib/data/site-generation-chunk-sessions";
import { buildJournalFactsGenerateSite, tryAppendClaudeActivityJournal } from "@/lib/ai/claude-activity-journal";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { tryLogSiteGenerationRun } from "@/lib/data/log-site-generation-run";
import { isValidSubfolderSlug } from "@/lib/slug";

export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false, error: "Sessie-id ontbreekt." }, { status: 400 });
  }

  const row = await getSiteGenerationChunkSession(id);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Sessie niet gevonden of verlopen." }, { status: 404 });
  }

  if (Date.parse(row.expires_at) < Date.now()) {
    await deleteSiteGenerationChunkSession(id);
    return NextResponse.json({ ok: false, error: "Sessie verlopen — start opnieuw." }, { status: 410 });
  }

  let payload;
  try {
    payload = parseChunkSessionPayloadFromStorage(row.payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Ongeldige sessie-data." },
      { status: 500 },
    );
  }

  const { nextPayload, result } = await advanceChunkedSiteGenerationSession(payload);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }

  if (result.complete) {
    const data = result.data;
    const slug = payload.checkpoint.promptOptionsTail?.siteStorageSubfolderSlug?.trim();
    const businessName = payload.checkpoint.businessName;
    const description = payload.checkpoint.description;

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
    if (slug && isValidSubfolderSlug(slug)) {
      await tryLogSiteGenerationRun({
        subfolderSlug: slug,
        operation: "full_generate_chunked",
        promptExcerpt: `${businessName}\n${description}`,
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        status: "success",
        outcome: "unknown",
        presetIds: null,
        layoutArchetypes: null,
        commandChain: ["full_generate_chunked", "tailwind_sections"],
      });
    }
    await deleteSiteGenerationChunkSession(id);
    return NextResponse.json({ ok: true, complete: true, data });
  }

  const okSave = await updateSiteGenerationChunkSession(id, JSON.parse(JSON.stringify(nextPayload)) as never);
  if (!okSave) {
    return NextResponse.json(
      { ok: false, error: "Kon voortgang niet opslaan (database). Probeer opnieuw." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    complete: false,
    message: result.message,
    phase: result.phase,
    landingIndex: result.landingIndex,
    landingTotal: result.landingTotal,
    marketingIndex: result.marketingIndex,
    marketingTotal: result.marketingTotal,
    streamingPreview: result.streamingPreview,
  });
}
