import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

/**
 * Alleen het gekoppelde portaal-account (`portal_user_id`), niet studio-preview.
 */
export async function requirePortalOwnerForClient(
  clientId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 503; message: string }> {
  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, status: 503, message: "Serverconfiguratie ontbreekt." };
  }

  const { data, error } = await supabase
    .from("clients")
    .select("portal_user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    if (isPostgrestUnknownColumnError(error, "portal_user_id")) {
      return { ok: false, status: 503, message: "Portaalkoppeling nog niet beschikbaar." };
    }
    return { ok: false, status: 503, message: error.message };
  }

  const row = data as { portal_user_id?: string | null } | null;
  const portalUserId = row?.portal_user_id ?? null;
  if (!portalUserId || portalUserId !== userId) {
    return {
      ok: false,
      status: 403,
      message: "Alleen het portaal-account van deze klant kan browsermeldingen beheren.",
    };
  }

  return { ok: true };
}
