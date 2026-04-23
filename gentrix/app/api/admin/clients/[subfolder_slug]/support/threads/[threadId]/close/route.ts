import { NextResponse } from "next/server";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ subfolder_slug: string; threadId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }

  const { subfolder_slug: raw, threadId } = await context.params;
  const subfolder_slug = decodeURIComponent(raw);
  if (!isValidSubfolderSlug(subfolder_slug) || !/^[0-9a-f-]{36}$/i.test(threadId)) {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  const client = await getAdminClientBySlug(subfolder_slug);
  if (!client) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: th, error: thErr } = await supabase
    .from("client_support_threads")
    .select("id, client_id, status")
    .eq("id", threadId)
    .maybeSingle();

  if (thErr || !th || th.client_id !== client.id) {
    return NextResponse.json({ ok: false, error: "Gesprek niet gevonden." }, { status: 404 });
  }
  if (th.status === "closed") {
    return NextResponse.json({ ok: true, thread: { id: threadId, status: "closed" }, alreadyClosed: true });
  }

  const { data, error } = await supabase
    .from("client_support_threads")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
      closed_by_staff_user_id: auth.userId,
    })
    .eq("id", threadId)
    .select("id, client_id, status, subject, created_at, updated_at, closed_at, closed_by_staff_user_id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Sluiten mislukt." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, thread: data });
}
