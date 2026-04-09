import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { userMayActAsStudioForPortalApis } from "@/lib/portal/portal-access-policy";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type PortalApiAccessOk = { ok: true; userId: string; clientId: string };

export type PortalApiAccessResult =
  | PortalApiAccessOk
  | { ok: false; status: 401 | 403 | 404 | 503; message: string };

/**
 * Ingelogde gebruiker + MFA-indien vereist; daarna: gekoppelde klant (`portal_user_id`)
 * of studio-bypass via `PORTAL_STUDIO_PREVIEW_USER_IDS` / niet-strikte modus.
 */
export async function requirePortalApiAccessForSlug(rawSlug: string): Promise<PortalApiAccessResult> {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return { ok: false, status: auth.status, message: auth.message };
  }

  const slug = decodeURIComponent(rawSlug);
  if (!isValidSubfolderSlug(slug)) {
    return { ok: false, status: 404, message: "Portaal niet gevonden." };
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch {
    return { ok: false, status: 503, message: "Serverconfiguratie ontbreekt." };
  }

  let q = await supabase
    .from("clients")
    .select("id, status, portal_user_id")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (q.error && isPostgrestUnknownColumnError(q.error, "portal_user_id")) {
    q = await supabase.from("clients").select("id, status").eq("subfolder_slug", slug).maybeSingle();
  }

  if (q.error || !q.data) {
    return { ok: false, status: 404, message: "Portaal niet gevonden." };
  }

  const row = q.data as { id: string; status: string; portal_user_id?: string | null };
  if (row.status !== "active") {
    return { ok: false, status: 404, message: "Portaal niet gevonden." };
  }

  const portalUserId = row.portal_user_id ?? null;
  if (portalUserId && portalUserId === auth.userId) {
    return { ok: true, userId: auth.userId, clientId: row.id };
  }

  if (userMayActAsStudioForPortalApis(auth.userId)) {
    return { ok: true, userId: auth.userId, clientId: row.id };
  }

  return {
    ok: false,
    status: 403,
    message: "Geen toegang tot dit klantportaal. Log in met het account uit de uitnodiging of vraag toegang aan je studio.",
  };
}
