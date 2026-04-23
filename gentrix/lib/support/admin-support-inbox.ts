import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidSubfolderSlug } from "@/lib/slug";
import type { Database } from "@/lib/types/database";

export type AdminSupportInboxRow = {
  threadId: string;
  clientId: string;
  subfolder_slug: string;
  subject: string;
  updated_at: string;
};

type ThreadAwaitRow = Pick<
  Database["public"]["Tables"]["client_support_threads"]["Row"],
  "id" | "client_id" | "subject" | "updated_at"
>;
type MsgAuthorRow = Pick<
  Database["public"]["Tables"]["client_support_messages"]["Row"],
  "thread_id" | "author_kind" | "created_at"
>;
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "subfolder_slug">;

/**
 * Open support-threads waarvan het **laatste** bericht van de klant is (studio moet nog antwoorden).
 * Geen extra DB-kolommen: afgeleid uit `client_support_messages`.
 */
export async function listAwaitingSupportReplyRows(
  supabase: SupabaseClient,
  opts?: { subfolderSlug?: string; maxThreads?: number },
): Promise<AdminSupportInboxRow[]> {
  const maxThreads = Math.min(Math.max(opts?.maxThreads ?? 200, 1), 500);
  const slugFilter = opts?.subfolderSlug?.trim();
  if (slugFilter && !isValidSubfolderSlug(slugFilter)) {
    return [];
  }

  const { data: threads, error: tErr } = await supabase
    .from("client_support_threads")
    .select("id, client_id, subject, updated_at")
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(maxThreads);

  if (tErr || !threads?.length) {
    if (process.env.NODE_ENV === "development" && tErr) {
      console.warn("[listAwaitingSupportReplyRows]", tErr.message);
    }
    return [];
  }

  const threadRows = threads as unknown as ThreadAwaitRow[];
  const threadIds = threadRows.map((t) => t.id);
  const { data: messages, error: mErr } = await supabase
    .from("client_support_messages")
    .select("thread_id, author_kind, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  if (mErr || !messages) {
    return [];
  }

  const msgRows = messages as unknown as MsgAuthorRow[];
  const lastAuthorByThread = new Map<string, string>();
  for (const m of msgRows) {
    if (!lastAuthorByThread.has(m.thread_id)) {
      lastAuthorByThread.set(m.thread_id, m.author_kind);
    }
  }

  let awaiting = threadRows.filter((t) => lastAuthorByThread.get(t.id) === "customer");
  const clientIds = [...new Set(awaiting.map((t) => t.client_id))];

  const { data: clients, error: cErr } = await supabase
    .from("clients")
    .select("id, subfolder_slug")
    .in("id", clientIds);

  if (cErr || !clients?.length) {
    return [];
  }

  const clientRows = clients as unknown as ClientRow[];
  const slugByClientId = new Map<string, string>(clientRows.map((c) => [c.id, c.subfolder_slug]));

  if (slugFilter) {
    awaiting = awaiting.filter((t) => slugByClientId.get(t.client_id) === slugFilter);
  }

  return awaiting.map((t) => ({
    threadId: t.id,
    clientId: t.client_id,
    subfolder_slug: slugByClientId.get(t.client_id) ?? "",
    subject: t.subject,
    updated_at: t.updated_at,
  }));
}
