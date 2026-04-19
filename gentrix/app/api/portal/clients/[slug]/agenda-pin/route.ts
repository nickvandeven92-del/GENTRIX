import { NextResponse } from "next/server";
import { z } from "zod";
import { hashAgendaPin, isValidAgendaPinFormat } from "@/lib/agenda/agenda-pin";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:agenda-pin:get:${slug}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("agenda_kiosk_pin_hash")
      .eq("id", access.clientId)
      .maybeSingle();

    if (error) {
      if (isPostgrestUnknownColumnError(error, "agenda_kiosk_pin_hash")) {
        return NextResponse.json({ ok: true, pinSet: false, migrationNeeded: true });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const row = data as { agenda_kiosk_pin_hash?: string | null } | null;
    const h = row?.agenda_kiosk_pin_hash;
    return NextResponse.json({ ok: true, pinSet: Boolean(h && String(h).length > 0) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}

const putSchema = z.object({
  pin: z.union([z.string(), z.null()]),
});

export async function PUT(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:agenda-pin:put:${slug}`, 20)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
  }

  const pinRaw = parsed.data.pin;
  const hash = pinRaw == null || pinRaw === "" ? null : isValidAgendaPinFormat(pinRaw) ? hashAgendaPin(pinRaw) : null;
  if (pinRaw != null && pinRaw !== "" && hash === null) {
    return NextResponse.json({ ok: false, error: "PIN moet 4 tot 6 cijfers zijn." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("clients")
      .update({ agenda_kiosk_pin_hash: hash })
      .eq("id", access.clientId);

    if (error) {
      if (isPostgrestUnknownColumnError(error, "agenda_kiosk_pin_hash")) {
        return NextResponse.json(
          { ok: false, error: "Database-migratie ontbreekt: agenda_kiosk_pin_hash. Voer de Supabase-migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
