import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientDossierNoteRow = {
  id: string;
  client_id: string;
  body: string;
  created_by: string;
  created_by_label: string;
  created_at: string;
};

/** Nieuwste eerst. Lege lijst bij ontbrekende tabel of fout. */
export async function listClientDossierNotes(clientId: string): Promise<ClientDossierNoteRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("client_dossier_notes")
    .select("id, client_id, body, created_by, created_by_label, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[listClientDossierNotes]", error.message);
    }
    return [];
  }

  return (data ?? []) as unknown as ClientDossierNoteRow[];
}
