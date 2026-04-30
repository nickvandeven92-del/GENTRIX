import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const REQUIRE_MFA = process.env.REQUIRE_MFA === "true";

export async function GET(): Promise<NextResponse> {
  if (!REQUIRE_MFA) {
    return NextResponse.json({ enabled: false });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("admin_email_mfa")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: data !== null });
}
