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

const bodySchema = z.object({
  messages: siteChatRequestMessagesSchema,
  sections: tailwindSectionsArraySchema,
  config: tailwindPageConfigSchema.optional().nullable(),
  attachmentUrls: z.array(z.string().url()).max(12).optional(),
  appointmentsEnabled: z.boolean().optional(),
  webshopEnabled: z.boolean().optional(),
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
    },
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
