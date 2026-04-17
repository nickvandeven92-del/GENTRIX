import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import {
  createGenerateSiteReadableStream,
  type GenerateSitePromptOptions,
} from "@/lib/ai/generate-site-with-claude";
import {
  buildJournalFactsGenerateSite,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import { generateSiteRequestBodySchema } from "@/lib/api/generate-site-request-schema";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import { tryLogSiteGenerationRun } from "@/lib/data/log-site-generation-run";
import { getRecentClientNamesForPrompt } from "@/lib/data/recent-clients-for-prompt";
import { isValidSubfolderSlug } from "@/lib/slug";

/** Langere runs: prepare + Denklijn + grote JSON-stream + Unsplash. Hobby: max 300s deploybaar; op Pro kun je 800. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.message }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Ongeldige JSON-body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = generateSiteRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const recentNames = await getRecentClientNamesForPrompt(3);
  const businessName = parsed.data.businessName;
  const description = parsed.data.description;
  const clientImages = parsed.data.clientImages ?? [];
  const briefingReferenceImages = parsed.data.briefingReferenceImages ?? [];
  const referenceStyleUrl = parsed.data.reference_style_url;

  const promptOpts: GenerateSitePromptOptions = {
    ...(clientImages.length > 0 ? { clientImages } : {}),
    ...(briefingReferenceImages.length > 0 ? { briefingReferenceImages } : {}),
    ...(referenceStyleUrl ? { referenceStyleUrl } : {}),
    ...(parsed.data.marketing_page_slugs?.length ? { marketingPageSlugs: parsed.data.marketing_page_slugs } : {}),
  };
  const hasPromptOpts = Object.keys(promptOpts).length > 0;

  const stream = createGenerateSiteReadableStream(
    businessName,
    description,
    recentNames,
    hasPromptOpts ? promptOpts : undefined,
    {
      onSuccess: async (data) => {
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
        const slug = parsed.data.subfolder_slug?.trim();
        if (slug && isValidSubfolderSlug(slug)) {
          const excerpt = `${businessName}\n${description}`;
          await tryLogSiteGenerationRun({
            subfolderSlug: slug,
            operation: "full_generate_stream",
            promptExcerpt: excerpt,
            model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
            status: "success",
            outcome: "unknown",
            presetIds: parsed.data.generation_preset_ids ?? null,
            layoutArchetypes: parsed.data.layout_archetypes ?? null,
            commandChain: ["full_generate_stream", "tailwind_sections"],
          });
        }
      },
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
