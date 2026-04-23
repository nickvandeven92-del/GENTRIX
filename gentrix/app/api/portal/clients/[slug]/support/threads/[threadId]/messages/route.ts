import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string; threadId: string }> };

const postSchema = z.object({
  body: z.string().trim().min(1, "Bericht mag niet leeg zijn.").max(8000, "Maximaal 8000 tekens."),
});

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw, threadId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:support:msg:get:${slug}:${threadId}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return NextResponse.json({ ok: false, error: "Ongeldig gesprek." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: th, error: thErr } = await supabase
      .from("client_support_threads")
      .select("id, client_id, status")
      .eq("id", threadId)
      .maybeSingle();

    if (thErr || !th || th.client_id !== access.clientId) {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json({ ok: false, error: "Serverconfiguratie ontbreekt." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw, threadId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:support:msg:post:${slug}:${threadId}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(threadId)) {
    return NextResponse.json({ ok: false, error: "Ongeldig gesprek." }, { status: 400 });
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

  try {
    const supabase = createServiceRoleClient();
    const { data: th, error: thErr } = await supabase
      .from("client_support_threads")
      .select("id, client_id, status")
      .eq("id", threadId)
      .maybeSingle();

    if (thErr || !th || th.client_id !== access.clientId) {
      return NextResponse.json({ ok: false, error: "Gesprek niet gevonden." }, { status: 404 });
    }
    if (th.status !== "open") {
      return NextResponse.json({ ok: false, error: "Dit gesprek is gesloten. Start een nieuw onderwerp." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("client_support_messages")
      .insert({
        thread_id: threadId,
        author_kind: "customer",
        body: parsed.data.body.trim(),
        portal_user_id: access.userId,
      })
      .select("id, thread_id, author_kind, body, portal_user_id, staff_user_id, staff_display_name, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message ?? "Opslaan mislukt." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json({ ok: false, error: "Serverconfiguratie ontbreekt." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
