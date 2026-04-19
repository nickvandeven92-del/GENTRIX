import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import {
  buildJournalFactsSiteChat,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import {
  siteChatRequestMessagesSchema,
  siteChatWithClaude,
} from "@/lib/ai/site-chat-with-claude";
import { tailwindPageConfigSchema, tailwindSectionsArraySchema } from "@/lib/ai/tailwind-sections-schema";

const bodySchema = z
  .object({
    messages: siteChatRequestMessagesSchema,
    sections: tailwindSectionsArraySchema,
    config: tailwindPageConfigSchema.optional().nullable(),
    attachmentUrls: z.array(z.string().url()).max(12).optional(),
    appointmentsEnabled: z.boolean().optional(),
    webshopEnabled: z.boolean().optional(),
    /** Wanneer gezet: na chat merge ook AI-hero (Gemini/OpenAI). Stock-URL-strip draait altijd server-side. */
    businessName: z.string().min(1).max(200).optional(),
    subfolder_slug: z.string().min(2).max(64).optional(),
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
    const bn = parsed.data.businessName?.trim();
    const result = await siteChatWithClaude(
      parsed.data.messages,
      parsed.data.sections,
      parsed.data.config ?? undefined,
      parsed.data.attachmentUrls ?? [],
      {
        appointmentsEnabled: parsed.data.appointmentsEnabled,
        webshopEnabled: parsed.data.webshopEnabled,
      },
      {
        businessName: bn?.trim() || "Studio",
        subfolderSlug: parsed.data.subfolder_slug?.trim() || undefined,
      },
      parsed.data.target_section_indices,
    );
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, rawText: result.rawText },
        { status: 422 },
      );
    }

    const msgs = parsed.data.messages;
    const lastUser = msgs[msgs.length - 1];
    if (result.sections) {
      await tryAppendClaudeActivityJournal({
        source: "site_chat",
        factsMarkdown: buildJournalFactsSiteChat({
          lastUserMessage: lastUser?.content ?? "",
          siteChanged: true,
          sectionCount: parsed.data.sections.length,
          config: parsed.data.config ?? undefined,
        }),
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        reply: result.reply,
        sections: result.sections,
        config: result.config ?? null,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout bij Claude.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
