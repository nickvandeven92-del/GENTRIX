import { cookies } from "next/headers";
import { EMAIL_MFA_COOKIE_NAME, verifyEmailMfaCookie } from "@/lib/auth/email-mfa-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: 401 | 403; message: string };

/**
 * Voor API-routes: ingelogd + MFA voltooid (AAL2 wanneer Supabase TOTP actief is, anders e-mail MFA cookie).
 * Ook gebruikt voor klantportaal-API’s (naam is historisch: het is “sessie + MFA”, geen aparte admin-rol in JWT).
 *
 * Security-rationale:
 *   Middleware (`lib/supabase/middleware.ts`) dwingt MFA af voor pagina's. API-routes kregen
 *   daarvóór alleen TOTP-AAL2 te zien; deze helper sluit de e-mail-MFA cookie-check aan zodat
 *   directe `fetch`-calls op `/api/*` dezelfde lat halen als de browser-UI.
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
    const needsTotp = aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (needsTotp) {
      return { ok: false, status: 403, message: "Twee-stapsverificatie vereist." };
    }

    if (!needsTotp) {
      // E-mail MFA is verplicht wanneer er géén TOTP-AAL2 is. Identiek aan middleware-gedrag.
      const jar = await cookies();
      const cookieValue = jar.get(EMAIL_MFA_COOKIE_NAME)?.value ?? "";
      const valid = cookieValue ? await verifyEmailMfaCookie(cookieValue, user.id) : false;
      if (!valid) {
        return {
          ok: false,
          status: 403,
          message: "Extra verificatie vereist — log opnieuw in met de e-mailcode.",
        };
      }
    }

    return { ok: true, userId: user.id, email: user.email ?? null };
  } catch {
    return { ok: false, status: 401, message: "Authenticatie mislukt." };
  }
}
