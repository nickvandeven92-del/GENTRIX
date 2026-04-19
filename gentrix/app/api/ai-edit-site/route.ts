import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildJournalFactsEditSite,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import { editSiteWithClaude } from "@/lib/ai/edit-site-with-claude";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { tailwindPageConfigSchema, tailwindSectionsArraySchema } from "@/lib/ai/tailwind-sections-schema";

const bodySchema = z
  .object({
    instruction: z.string().min(3, "Geef een duidelijke instructie.").max(8000),
    sections: tailwindSectionsArraySchema,
    config: tailwindPageConfigSchema.optional().nullable(),
    /** Optioneel: alleen deze sectie-indices volledig meesturen + model mag alleen deze indices in sectionUpdates wijzigen. */
    target_section_indices: z.array(z.number().int().min(0)).max(24).optional(),
  })
  .superRefine((data, ctx) => {
    const targets = data.target_section_indices;
    if (!targets?.length) return;
    const n = data.sections.length;
    for (let i = 0; i < targets.length; i++) {
      const idx = targets[i]!;
      if (idx >= n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `target_section_indices[${i}] is ${idx}, maar er zijn maar ${n} sectie(s) (0–${n - 1}).`,
          path: ["target_section_indices", i],
        });
      }
    }
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

  try {
    const result = await editSiteWithClaude(
      parsed.data.instruction,
      parsed.data.sections,
      parsed.data.config ?? undefined,
      parsed.data.target_section_indices,
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, rawText: result.rawText },
        { status: 422 },
      );
    }

    await tryAppendClaudeActivityJournal({
      source: "edit_site",
      factsMarkdown: buildJournalFactsEditSite({
        instruction: parsed.data.instruction,
        sectionCount: parsed.data.sections.length,
        config: parsed.data.config ?? undefined,
      }),
    });

    return NextResponse.json({
      ok: true,
      data: {
        sections: result.sections,
        config: result.config ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout bij Claude.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
