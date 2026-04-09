import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

const bodySchema = z.object({
  confirm: z.string(),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:sub:cancel:${slug}`, 15)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || parsed.data.confirm !== "OPZEGGEN") {
    return NextResponse.json(
      { ok: false, error: 'Typ exact OPZEGGEN om te bevestigen.' },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    let { data: client, error: fetchErr } = await supabase
      .from("clients")
      .select("id, plan_type, subscription_cancel_at_period_end, portal_account_enabled")
      .eq("id", resolved.clientId)
      .maybeSingle();

    if (fetchErr && isPostgrestUnknownColumnError(fetchErr, "portal_account_enabled")) {
      const second = await supabase
        .from("clients")
        .select("id, plan_type, subscription_cancel_at_period_end")
        .eq("id", resolved.clientId)
        .maybeSingle();
      fetchErr = second.error;
      client = second.data
        ? { ...second.data, portal_account_enabled: true as const }
        : null;
    }

    if (fetchErr || !client) {
      return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });
    }

    const row = client as {
      plan_type: string | null;
      subscription_cancel_at_period_end?: boolean;
      portal_account_enabled?: boolean;
    };
    if (row.portal_account_enabled === false) {
      return NextResponse.json(
        { ok: false, error: "Account-module staat uit voor dit portaal." },
        { status: 403 },
      );
    }
    if (row.plan_type !== "subscription") {
      return NextResponse.json(
        { ok: false, error: "Geen doorlopend abonnement geregistreerd voor dit dossier." },
        { status: 400 },
      );
    }

    if (row.subscription_cancel_at_period_end) {
      return NextResponse.json({ ok: true, already: true });
    }

    const { error: updErr } = await supabase
      .from("clients")
      .update({
        subscription_cancel_at_period_end: true,
        subscription_cancel_requested_at: new Date().toISOString(),
      })
      .eq("id", resolved.clientId);

    if (updErr) {
      if (updErr.message?.includes("subscription_cancel")) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer 20260406180000_portal_subscription_cancel.sql uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
