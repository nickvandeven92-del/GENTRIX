import type { SupabaseClient } from "@supabase/supabase-js";
import { isPortalStrictAccessEnabled } from "@/lib/portal/portal-access-policy";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Studio bekijkt het portaal terwijl de sessie niet bij `portal_user_id` hoort
 * (of die koppeling ontbreekt nog).
 */
export async function isStudioPortalPreview(portalUserId: string | null): Promise<boolean> {
  if (process.env.PORTAL_HIDE_STUDIO_PREVIEW_BANNER === "1") return false;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;

  if (!portalUserId) return true;
  return user.id !== portalUserId;
}

/**
 * Supabase-client voor server-side portaal-leesdata: bij studio-voorbeeld service role (RLS-veilige volledige data).
 */
export async function getSupabaseForPortalDataReads(portalUserId: string | null): Promise<SupabaseClient> {
  if (await isStudioPortalPreview(portalUserId)) {
    return createServiceRoleClient();
  }
  return await createSupabaseServerClient();
}

/**
 * Mag deze ingelogde gebruiker /portal/* voor dit dossier openen?
 * (Layout gebruikt dit na een expliciete sessie-check.)
 */
export function canAccessPortalForUserId(portalUserId: string | null, userId: string): boolean {
  if (!isPortalStrictAccessEnabled()) return true;
  if (portalUserId && portalUserId === userId) return true;
  const raw = process.env.PORTAL_STUDIO_PREVIEW_USER_IDS?.trim();
  if (!raw) return false;
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return allowed.has(userId);
}

export async function canAccessPortalRoute(portalUserId: string | null): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return false;
  return canAccessPortalForUserId(portalUserId, user.id);
}
