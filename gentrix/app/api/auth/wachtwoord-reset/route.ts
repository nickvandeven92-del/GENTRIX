/**
 * POST /api/auth/wachtwoord-reset
 *
 * Genereert een Supabase recovery-link via de service-role client en stuurt
 * een branded wachtwoord-reset email via Resend — zodat Supabase's eigen mail
 * niet uitgestuurd wordt.
 *
 * Body: { email: string }
 * Response: altijd 200 (geen user-enumeration via foutmelding).
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendPasswordResetEmail } from "@/lib/email/account-emails";
import { getPublicAppUrl } from "@/lib/site/public-app-url";

export async function POST(request: Request): Promise<NextResponse> {
  const silentOk = NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Ongeldige aanvraag" }, { status: 400 });
  }

  const email = (body as Record<string, unknown>).email;
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Ongeldig e-mailadres" }, { status: 422 });
  }

  try {
    const supabase = createServiceRoleClient();
    const redirectTo = `${getPublicAppUrl()}/auth/callback?type=recovery&next=/wachtwoord-instellen`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      // Stil falen — geeft aanvaller geen info over bestaande accounts.
      if (process.env.NODE_ENV === "development") {
        console.warn("[wachtwoord-reset] generateLink fout:", error?.message);
      }
      return silentOk;
    }

    const result = await sendPasswordResetEmail({
      to: email.trim().toLowerCase(),
      resetUrl: data.properties.action_link,
    });

    if (!result.ok && process.env.NODE_ENV === "development") {
      console.warn("[wachtwoord-reset] Email mislukt:", result.error);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[wachtwoord-reset] Onverwachte fout:", e);
    }
  }

  return silentOk;
}
