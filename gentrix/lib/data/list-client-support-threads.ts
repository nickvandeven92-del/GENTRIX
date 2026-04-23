import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientSupportThreadRow = {
  id: string;
  client_id: string;
  status: "open" | "closed";
  subject: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

/** Nieuwste activiteit eerst. Lege lijst bij ontbrekende tabel of fout. */
export async function listClientSupportThreads(
  clientId: string,
  filter: "open" | "closed" | "all" = "all",
): Promise<ClientSupportThreadRow[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("client_support_threads")
    .select("id, client_id, status, subject, created_at, updated_at, closed_at")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filter === "open") {
    q = q.eq("status", "open");
  } else if (filter === "closed") {
    q = q.eq("status", "closed");
  }

  const { data, error } = await q;

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[listClientSupportThreads]", error.message);
    }
    return [];
  }

  return (data ?? []) as unknown as ClientSupportThreadRow[];
}
