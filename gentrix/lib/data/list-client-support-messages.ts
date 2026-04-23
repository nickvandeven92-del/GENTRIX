import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientSupportMessageRow = {
  id: string;
  thread_id: string;
  author_kind: "customer" | "staff";
  body: string;
  portal_user_id: string | null;
  staff_user_id: string | null;
  staff_display_name: string | null;
  created_at: string;
};

/** Chronologisch. Lege lijst bij ontbrekende tabel of fout. */
export async function listClientSupportMessages(threadId: string): Promise<ClientSupportMessageRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_support_messages")
    .select("id, thread_id, author_kind, body, portal_user_id, staff_user_id, staff_display_name, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[listClientSupportMessages]", error.message);
    }
    return [];
  }

  return (data ?? []) as unknown as ClientSupportMessageRow[];
}
