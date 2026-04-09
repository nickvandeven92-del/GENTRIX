import { NextResponse } from "next/server";
import { buildAppointmentIcsCalendar } from "@/lib/calendar/appointment-ics";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { slug: raw, id: appointmentId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld." }, { status: 403 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("client_appointments")
      .select("id, title, starts_at, ends_at, notes, status")
      .eq("id", appointmentId)
      .eq("client_id", resolved.clientId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "Afspraak niet gevonden." }, { status: 404 });
    }

    if (data.status === "cancelled") {
      return NextResponse.json({ ok: false, error: "Geannuleerde afspraak heeft geen agenda-export." }, { status: 400 });
    }

    const startsAt = new Date(data.starts_at);
    const endsAt = new Date(data.ends_at);
    const ics = buildAppointmentIcsCalendar({
      uid: `${data.id}@portal-website-fabriek`,
      title: data.title,
      startsAt,
      endsAt,
      notes: data.notes,
      organizerName: resolved.name,
    });

    const filename = `afspraak-${data.id.slice(0, 8)}.ics`;
    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
