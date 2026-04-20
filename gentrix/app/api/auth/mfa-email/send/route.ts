import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendMfaCodeEmail } from "@/lib/email/mfa-email";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minuten

function randomDigits(length: number): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => (b % 10).toString()).join("");
}

async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const serviceRole = createServiceRoleClient();

  // Verwijder verlopen / eerder verstuurde codes
  await serviceRole
    .from("admin_email_mfa_codes")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());

  const code = randomDigits(6);
  const codeHash = await sha256hex(code);
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

  return NextResponse.json({ codeId: row.id });
}
