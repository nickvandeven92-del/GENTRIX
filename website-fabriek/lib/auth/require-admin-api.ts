import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Voor API-routes: ingelogd + MFA voltooid (AAL2) wanneer Supabase MFA actief is voor de sessie.
 * Ook gebruikt voor klantportaal-API’s (naam is historisch: het is “sessie + MFA”, geen aparte admin-rol in JWT).
 */
export async function requireAdminApiAuth(): Promise<AdminAuthResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, status: 401, message: "Niet ingelogd." };
    }

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (needsMfa) {
      return { ok: false, status: 403, message: "Twee-stapsverificatie vereist." };
    }

    return { ok: true, userId: user.id, email: user.email ?? null };
  } catch {
    return { ok: false, status: 401, message: "Authenticatie mislukt." };
  }
}
