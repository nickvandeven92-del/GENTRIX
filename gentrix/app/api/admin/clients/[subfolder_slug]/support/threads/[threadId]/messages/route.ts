import { NextResponse } from "next/server";
import { z } from "zod";
import { actorDisplayLabel } from "@/lib/auth/actor-display-label";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ subfolder_slug: string; threadId: string }> };

const postSchema = z.object({
  body: z.string().trim().min(1, "Bericht mag niet leeg zijn.").max(8000, "Maximaal 8000 tekens."),
});

export async function GET(_request: Request, context: RouteContext) {
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

  const { data, error } = await supabase
    .from("client_support_messages")
    .select("id, thread_id, author_kind, body, portal_user_id, staff_user_id, staff_display_name, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, messages: data ?? [], threadStatus: th.status });
}

export async function POST(request: Request, context: RouteContext) {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." }, { status: 400 });
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
  if (th.status !== "open") {
    return NextResponse.json({ ok: false, error: "Dit gesprek is gesloten." }, { status: 409 });
  }

  const display = actorDisplayLabel(auth.userId, auth.email);

  const { data, error } = await supabase
    .from("client_support_messages")
    .insert({
      thread_id: threadId,
      author_kind: "staff",
      body: parsed.data.body.trim(),
      staff_user_id: auth.userId,
      staff_display_name: display,
    })
    .select("id, thread_id, author_kind, body, portal_user_id, staff_user_id, staff_display_name, created_at")
    .single();

  if (error || !data) {
    const msg = error?.message ?? "Opslaan mislukt.";
    if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
      return NextResponse.json(
        {
          ok: false,
          error: "Support-tabellen ontbreken. Voer de migratie voor client_support_* uit in Supabase.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: data });
}
