import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { fetchPortalSupportUnreadCountsByThread } from "@/lib/data/portal-support-unread";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string }> };

const postSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Typ je vraag.").max(8000, "Maximaal 8000 tekens."),
});

function subjectFromInput(subject: string | undefined, body: string): string {
  const s = subject?.trim();
  if (s && s.length > 0) return s.slice(0, 200);
  const line = body.split(/\r?\n/).find((l) => l.trim().length > 0) ?? body.trim();
  const one = line.trim().slice(0, 200);
  return one.length > 0 ? one : "Vraag";
}

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:support:list:${slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "all";
  const scopeNorm = scope === "open" || scope === "closed" ? scope : "all";

  try {
    const supabase = createServiceRoleClient();
    let q = supabase
      .from("client_support_threads")
      .select("id, client_id, status, subject, created_at, updated_at, closed_at")
      .eq("client_id", access.clientId)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (scopeNorm === "open") q = q.eq("status", "open");
    else if (scopeNorm === "closed") q = q.eq("status", "closed");

    const { data, error } = await q;
    if (error) {
      const msg = error.message ?? "";
      if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Support-chat is nog niet geactiveerd op de database. Voer migratie 20260430140000_client_support_chat.sql uit.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const unreadMap = await fetchPortalSupportUnreadCountsByThread(access.clientId);
    const threads = (data ?? []).map((t: { id: string }) => ({
      ...t,
      unread_staff_count: unreadMap.get(t.id) ?? 0,
    }));

    return NextResponse.json({ ok: true, threads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json({ ok: false, error: "Serverconfiguratie ontbreekt." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:support:create:${slug}`, 30)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (resolved.clientId !== access.clientId) {
    return NextResponse.json({ ok: false, error: "Ongeldige context." }, { status: 400 });
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

  const subject = subjectFromInput(parsed.data.subject, parsed.data.body);

  try {
    const supabase = createServiceRoleClient();
    const { data: thread, error: tErr } = await supabase
      .from("client_support_threads")
      .insert({
        client_id: access.clientId,
        status: "open",
        subject,
      })
      .select("id, client_id, status, subject, created_at, updated_at, closed_at")
      .single();

    if (tErr || !thread) {
      const msg = tErr?.message ?? "Thread aanmaken mislukt.";
      if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache")) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Support-chat is nog niet geactiveerd op de database. Voer migratie 20260430140000_client_support_chat.sql uit.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const { error: mErr } = await supabase.from("client_support_messages").insert({
      thread_id: thread.id,
      author_kind: "customer",
      body: parsed.data.body.trim(),
      portal_user_id: access.userId,
    });

    if (mErr) {
      await supabase.from("client_support_threads").delete().eq("id", thread.id);
      return NextResponse.json({ ok: false, error: mErr.message ?? "Bericht opslaan mislukt." }, { status: 500 });
    }

    await supabase
      .from("client_support_threads")
      .update({ customer_last_read_at: new Date().toISOString() })
      .eq("id", thread.id)
      .eq("client_id", access.clientId);

    return NextResponse.json({ ok: true, thread });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json({ ok: false, error: "Serverconfiguratie ontbreekt." }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
