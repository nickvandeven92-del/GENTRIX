import { NextResponse } from "next/server";
import { z } from "zod";
import { applySiteAiCommandSnapshot } from "@/lib/ai/apply-site-ai-command-snapshot";
import {
  buildJournalFactsEditSite,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import { instructionForSiteAiCommand, type SiteAiCommandId } from "@/lib/ai/site-ai-commands";
import { tailwindPageConfigSchema, tailwindSectionsArraySchema } from "@/lib/ai/tailwind-sections-schema";
import { projectSnapshotFromTailwindPayload, projectSnapshotToTailwindSectionsPayload } from "@/lib/site/project-snapshot-io";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { tryLogSiteGenerationRun } from "@/lib/data/log-site-generation-run";
import { isValidSubfolderSlug } from "@/lib/slug";
import { snapshotPageTypeSchema } from "@/lib/site/snapshot-page-type";
import { generatedLogoSetSchema } from "@/types/logo";

const bodySchema = z.object({
  command: z.enum(["tone_luxury_hero", "simplify_mobile_layout", "sharpen_primary_cta"]),
  /** Optioneel: koppel run aan klant (fase 5). */
  subfolder_slug: z.string().min(2).max(64).optional(),
  sections: tailwindSectionsArraySchema,
  pageType: snapshotPageTypeSchema.optional(),
  config: tailwindPageConfigSchema.optional().nullable(),
  customCss: z.string().max(48_000).optional(),
  customJs: z.string().max(48_000).optional(),
  logoSet: generatedLogoSetSchema.optional(),
  metaDocumentTitle: z.string().max(200).optional(),
});

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const command = parsed.data.command as SiteAiCommandId;

  const baseSnapshot = projectSnapshotFromTailwindPayload(
    {
      format: "tailwind_sections",
      sections: parsed.data.sections,
      ...(parsed.data.pageType != null ? { pageType: parsed.data.pageType } : {}),
      ...(parsed.data.config != null ? { config: parsed.data.config } : {}),
      ...(parsed.data.customCss != null && parsed.data.customCss !== ""
        ? { customCss: parsed.data.customCss }
        : {}),
      ...(parsed.data.customJs != null && parsed.data.customJs !== "" ? { customJs: parsed.data.customJs } : {}),
      ...(parsed.data.logoSet != null ? { logoSet: parsed.data.logoSet } : {}),
    },
    {
      generationSource: "editor",
      documentTitle: parsed.data.metaDocumentTitle?.trim(),
    },
  );

  try {
    const result = await applySiteAiCommandSnapshot(command, baseSnapshot);
    if (!result.ok) {
      const slugFail = parsed.data.subfolder_slug?.trim();
      if (slugFail && isValidSubfolderSlug(slugFail)) {
        await tryLogSiteGenerationRun({
          subfolderSlug: slugFail,
          operation: `ai_command:${command}`,
          promptExcerpt: (result.error ?? "command failed").slice(0, 2000),
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
          status: "failure",
          outcome: "abandoned",
          commandChain: [command],
          interpretation: {
            kind: "ai_site_command",
            schemaVersion: 1,
            command,
            phase: "failure",
            error: (result.error ?? "").slice(0, 800),
          },
        });
      }
      return NextResponse.json(
        { ok: false, error: result.error, rawText: result.rawText },
        { status: 422 },
      );
    }

    const tw = projectSnapshotToTailwindSectionsPayload(result.snapshot);

    const slug = parsed.data.subfolder_slug?.trim();
    if (slug && isValidSubfolderSlug(slug)) {
      const excerpt = instructionForSiteAiCommand(command).slice(0, 2000);
      await tryLogSiteGenerationRun({
        subfolderSlug: slug,
        operation: `ai_command:${command}`,
        promptExcerpt: excerpt,
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        status: "success",
        outcome: "kept",
        commandChain: [command],
          interpretation: {
            kind: "ai_site_command",
            schemaVersion: 1,
            command,
            phase: "success",
            metrics: result.changeReport.metrics,
            updatedFields: result.changeReport.updatedFields,
            updatedSectionIds: result.changeReport.updatedSectionIds,
            lintDiagnosticCount: result.changeReport.metrics.lintDiagnosticCount,
            qualityDiagnosticCount: result.changeReport.metrics.qualityDiagnosticCount,
          },
      });
    }

    await tryAppendClaudeActivityJournal({
      source: "edit_site",
      factsMarkdown: buildJournalFactsEditSite({
        instruction: `[snapshot_command:${command}] ${instructionForSiteAiCommand(command).slice(0, 400)}`,
        sectionCount: tw.sections.length,
        config: tw.config ?? undefined,
      }),
    });

    return NextResponse.json({
      ok: true,
      data: {
        command,
        sections: tw.sections,
        config: tw.config ?? null,
        customCss: tw.customCss ?? "",
        customJs: tw.customJs ?? "",
        logoSet: tw.logoSet ?? null,
        changeReport: result.changeReport,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout bij Claude.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
