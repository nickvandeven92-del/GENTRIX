import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAgendaPin } from "@/lib/agenda/agenda-pin";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

const bodySchema = z.object({
  pin: z.string().min(1).max(12),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:agenda-pin:verify:${slug}`, 30)) {
    return NextResponse.json({ ok: false, error: "Te veel pogingen. Wacht even." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Ongeldige invoer." }, { status: 400 });
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
        return NextResponse.json({ ok: false, error: "PIN is nog niet beschikbaar (migratie)." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const row = data as { agenda_kiosk_pin_hash?: string | null } | null;
    const stored = row?.agenda_kiosk_pin_hash ?? null;
    if (!stored) {
      return NextResponse.json({ ok: false, error: "Geen PIN ingesteld." }, { status: 400 });
    }

    if (!verifyAgendaPin(parsed.data.pin, stored)) {
      return NextResponse.json({ ok: false, error: "Onjuiste PIN." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
