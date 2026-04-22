import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  signEmailMfaCookie,
  emailMfaCookieOptions,
  EMAIL_MFA_COOKIE_NAME,
} from "@/lib/auth/email-mfa-cookie";
import { MfaSigningSecretMissingError } from "@/lib/auth/mfa-signing-secret";
import { clearMfaAttempts, registerMfaAttempt } from "@/lib/auth/mfa-attempt-limiter";
import { sha256Hex } from "@/lib/auth/otp-code";

/** Expliciet Node i.v.m. `crypto.timingSafeEqual` / Buffer; voorkomt Edge/HTML-errorpagina’s bij falen. */
export const runtime = "nodejs";

const bodySchema = z.object({
  codeId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    return await handleVerify(request);
  } catch (err) {
    console.error("[mfa-email/verify]", err);
    if (err instanceof MfaSigningSecretMissingError) {
      return NextResponse.json(
        {
          error:
            "Serverconfiguratie ontbreekt (MFA_SIGNING_SECRET). Neem contact op met de beheerder.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Verificatie tijdelijk niet beschikbaar. Probeer het zo opnieuw." },
      { status: 500 },
    );
  }
}

async function handleVerify(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige invoer." }, { status: 400 });
  }

  const { codeId, code } = parsed.data;

  if (!registerMfaAttempt(codeId)) {
    // Te vaak mis → markeer de code als verbruikt zodat bruteforce ook na restart stopt.
    try {
      const serviceRole = createServiceRoleClient();
      await serviceRole
        .from("admin_email_mfa_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", codeId)
        .eq("user_id", user.id);
    } catch {
      /* stil falen — attempt-limiter blokkeert al verdere pogingen */
    }
    return NextResponse.json(
      { error: "Te veel pogingen. Vraag een nieuwe code aan." },
      { status: 429 },
    );
  }

  const codeHash = await sha256Hex(code);

  const serviceRole = createServiceRoleClient();

  const { data: row, error: fetchErr } = await serviceRole
    .from("admin_email_mfa_codes")
    .select("id, user_id, code_hash, expires_at, consumed_at")
    .eq("id", codeId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Code niet gevonden." }, { status: 400 });
  }

  if (row.consumed_at) {
    return NextResponse.json({ error: "Code is al gebruikt." }, { status: 400 });
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: "Code is verlopen." }, { status: 400 });
  }

  if (!constantTimeEqualHex(row.code_hash, codeHash)) {
    return NextResponse.json({ error: "Onjuiste code." }, { status: 400 });
  }

  await serviceRole
    .from("admin_email_mfa_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", codeId);

  clearMfaAttempts(codeId);

  const cookieValue = await signEmailMfaCookie(user.id);
  const opts = emailMfaCookieOptions();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EMAIL_MFA_COOKIE_NAME, cookieValue, opts);
  return response;
}
