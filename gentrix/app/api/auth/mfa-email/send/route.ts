import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendMfaCodeEmail } from "@/lib/email/mfa-email";
import { generateNumericOtp, sha256Hex } from "@/lib/auth/otp-code";
import { checkMemoryRateLimit } from "@/lib/api/rate-limit-memory";
import {
  EMAIL_MFA_COOKIE_NAME,
  clearEmailMfaCookieOptions,
} from "@/lib/auth/email-mfa-cookie";

const CODE_TTL_MS = 10 * 60 * 1000;

/** Beperkt mail-bombing en kostenexplosie via Resend: max. 5 codes per 10 min per user. */
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MS = 10 * 60 * 1000;

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  try {
    return await handleSend();
  } catch (err) {
    console.error("[mfa-email/send]", err);
    return NextResponse.json({ error: "Kon code niet aanmaken." }, { status: 500 });
  }
}

async function handleSend(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  if (!checkMemoryRateLimit(`mfa:send:${user.id}`, MAX_SENDS_PER_WINDOW, SEND_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Te veel aanvragen. Probeer over een paar minuten opnieuw." },
      { status: 429 },
    );
  }

  const serviceRole = createServiceRoleClient();

  await serviceRole
    .from("admin_email_mfa_codes")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());

  const code = generateNumericOtp(6);
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { data: row, error: insertErr } = await serviceRole
    .from("admin_email_mfa_codes")
    .insert({ user_id: user.id, code_hash: codeHash, expires_at: expiresAt })
    .select("id")
    .single();

  if (insertErr || !row) {
    console.error("[mfa-email/send]", insertErr?.message);
    return NextResponse.json({ error: "Kon code niet aanmaken." }, { status: 500 });
  }

  const emailResult = await sendMfaCodeEmail({ to: user.email, code });
  if (!emailResult.ok) {
    console.error("[mfa-email/send] email:", emailResult.error);
    return NextResponse.json({ error: "Kon e-mail niet versturen." }, { status: 500 });
  }

  const response = NextResponse.json({ codeId: row.id });
  /** Oude 24u-cookie mag niet meer gelden als er een nieuwe code actief is (anders middleware “ingelogd” zonder invoer). */
  response.cookies.set(EMAIL_MFA_COOKIE_NAME, "", clearEmailMfaCookieOptions());
  return response;
}
