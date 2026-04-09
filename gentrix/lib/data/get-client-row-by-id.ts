import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getClientSubfolderSlugById(clientId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("clients").select("subfolder_slug").eq("id", clientId).maybeSingle();
  if (error || !data) return null;
  return (data as { subfolder_slug: string }).subfolder_slug;
}
