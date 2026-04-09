import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type PortalClientLink = {
  subfolder_slug: string;
  name: string;
};

/**
 * Actieve klanten waar `portal_user_id` gelijk is aan de huidige sessie-user.
 * Leeg als niet ingelogd, kolom ontbreekt, of geen koppeling.
 */
export async function listPortalClientsLinkedToUser(): Promise<PortalClientLink[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from("clients")
    .select("subfolder_slug, name")
    .eq("status", "active")
    .eq("portal_user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    if (isPostgrestUnknownColumnError(error, "portal_user_id")) {
      return [];
    }
    return [];
  }

  return (data ?? []) as PortalClientLink[];
}
