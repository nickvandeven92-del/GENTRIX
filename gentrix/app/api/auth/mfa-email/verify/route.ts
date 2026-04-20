import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { signEmailMfaCookie, emailMfaCookieOptions, EMAIL_MFA_COOKIE_NAME } from "@/lib/auth/email-mfa-cookie";

const bodySchema = z.object({
  codeId: z.string().uuid(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request): Promise<NextResponse> {
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
  const codeHash = await sha256hex(code);

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

  if (row.code_hash !== codeHash) {
    return NextResponse.json({ error: "Onjuiste code." }, { status: 400 });
  }

  // Code is correct — markeer als gebruikt
  await serviceRole
    .from("admin_email_mfa_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", codeId);

  const cookieValue = await signEmailMfaCookie(user.id);
  const opts = emailMfaCookieOptions();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EMAIL_MFA_COOKIE_NAME, cookieValue, opts);
  return response;
}
