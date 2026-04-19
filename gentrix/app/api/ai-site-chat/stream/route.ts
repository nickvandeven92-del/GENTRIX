import {
  buildJournalFactsSiteChat,
  tryAppendClaudeActivityJournal,
} from "@/lib/ai/claude-activity-journal";
import {
  createSiteChatReadableStream,
  siteChatRequestMessagesSchema,
} from "@/lib/ai/site-chat-with-claude";
import { tailwindPageConfigSchema, tailwindSectionsArraySchema } from "@/lib/ai/tailwind-sections-schema";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { z } from "zod";

const bodySchema = z
  .object({
    messages: siteChatRequestMessagesSchema,
    sections: tailwindSectionsArraySchema,
    config: tailwindPageConfigSchema.optional().nullable(),
    attachmentUrls: z.array(z.string().url()).max(12).optional(),
    appointmentsEnabled: z.boolean().optional(),
    webshopEnabled: z.boolean().optional(),
    businessName: z.string().min(1).max(200).optional(),
    subfolder_slug: z.string().min(2).max(64).optional(),
    /** Optioneel: alleen deze sectie-indices volledig meesturen + model mag alleen deze indices wijzigen. */
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

/** Langere site-chat runs (grote JSON). */
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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join(" ");
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const msgs = parsed.data.messages;
  const lastUser = msgs[msgs.length - 1];

  const bn = parsed.data.businessName?.trim();
  const stream = createSiteChatReadableStream(
    msgs,
    parsed.data.sections,
    parsed.data.config ?? undefined,
    parsed.data.attachmentUrls ?? [],
    {
      appointmentsEnabled: parsed.data.appointmentsEnabled,
      webshopEnabled: parsed.data.webshopEnabled,
    },
    {
      onSuccess: async (data) => {
        if (data.sections?.length) {
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
      },
      /** Altijd meesturen: `mergeSiteChatSectionsWithOptionalAiHero` start alleen bij hero-gerichte user-tekst; default merk voor Gemini/OpenAI-prompt. */
      heroPostProcess: {
        businessName: bn?.trim() || "Studio",
        subfolderSlug: parsed.data.subfolder_slug?.trim() || undefined,
      },
      explicitTargetSectionIndices: parsed.data.target_section_indices,
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
