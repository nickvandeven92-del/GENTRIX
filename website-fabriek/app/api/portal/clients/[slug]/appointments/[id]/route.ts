import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import {
  trySendAppointmentCancelledEmail,
  trySendAppointmentUpdatedEmail,
  trySendBookerAppointmentCancelledEmail,
  trySendBookerAppointmentUpdatedEmail,
  type AppointmentEmailRow,
} from "@/lib/email/appointment-notifications";
import { getClientNotificationTarget } from "@/lib/data/get-client-notification-target";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  status: z.enum(["scheduled", "cancelled"]).optional(),
  notes: z.string().max(2000).optional().nullable(),
  booker_name: z.string().max(120).optional().nullable(),
  booker_email: z.union([z.string().email().max(254), z.literal("")]).optional().nullable(),
  booker_wants_confirmation: z.boolean().optional(),
  booker_wants_reminder: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { slug: raw, id: appointmentId } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }

  if (!checkPortalRateLimit(access.userId, `portal:appts:patch:${slug}:${appointmentId}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken. Probeer over een minuut opnieuw." }, { status: 429 });
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  if (!resolved.appointmentsEnabled) {
    return NextResponse.json({ ok: false, error: "Afspraken niet ingeschakeld voor deze klant." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  }

  const row: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) row.title = parsed.data.title.trim() || "Afspraak";
  if (parsed.data.status !== undefined) row.status = parsed.data.status;
  if (parsed.data.notes !== undefined) row.notes = parsed.data.notes?.trim() || null;
  if (parsed.data.booker_name !== undefined) row.booker_name = parsed.data.booker_name?.trim() || null;
  if (parsed.data.booker_email !== undefined) row.booker_email = parsed.data.booker_email?.trim() || null;
  if (parsed.data.booker_wants_confirmation !== undefined) {
    row.booker_wants_confirmation = parsed.data.booker_wants_confirmation;
  }
  if (parsed.data.booker_wants_reminder !== undefined) {
    row.booker_wants_reminder = parsed.data.booker_wants_reminder;
  }

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (parsed.data.starts_at !== undefined) {
    startsAt = new Date(parsed.data.starts_at);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Ongeldige starttijd." }, { status: 400 });
    }
    row.starts_at = startsAt.toISOString();
  }
  if (parsed.data.ends_at !== undefined) {
    endsAt = new Date(parsed.data.ends_at);
    if (Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Ongeldige eindtijd." }, { status: 400 });
    }
    row.ends_at = endsAt.toISOString();
  }

  if (parsed.data.starts_at !== undefined || parsed.data.ends_at !== undefined) {
    row.reminder_sent_at = null;
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: existing, error: fetchErr } = await supabase
      .from("client_appointments")
      .select(
        "id, starts_at, ends_at, status, title, notes, booker_name, booker_email, booker_wants_confirmation, booker_wants_reminder",
      )
      .eq("id", appointmentId)
      .eq("client_id", resolved.clientId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ ok: false, error: "Afspraak niet gevonden." }, { status: 404 });
    }

    const nextStart = row.starts_at != null ? new Date(String(row.starts_at)) : new Date(existing.starts_at);
    const nextEnd = row.ends_at != null ? new Date(String(row.ends_at)) : new Date(existing.ends_at);
    if (nextEnd <= nextStart) {
      return NextResponse.json({ ok: false, error: "Einde moet na start zijn." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("client_appointments")
      .update(row)
      .eq("id", appointmentId)
      .eq("client_id", resolved.clientId)
      .select(
        "id, title, starts_at, ends_at, status, notes, booker_name, booker_email, booker_wants_confirmation, booker_wants_reminder, reminder_sent_at, created_at, updated_at",
      )
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const target = await getClientNotificationTarget(resolved.clientId);
    const prev = existing as {
      status: string;
      starts_at: string;
      ends_at: string;
      booker_name: string | null;
      booker_email: string | null;
    };
    const next = data as AppointmentEmailRow;
    const becameCancelled =
      parsed.data.status === "cancelled" && prev.status === "scheduled" && next.status === "cancelled";
    const timesChanged = parsed.data.starts_at !== undefined || parsed.data.ends_at !== undefined;
    const bookerTo = prev.booker_email?.trim() || next.booker_email?.trim() || null;

    if (becameCancelled) {
      void trySendAppointmentCancelledEmail({
        to: target.email,
        clientName: target.name,
        appointment: next,
      });
      if (bookerTo) {
        void trySendBookerAppointmentCancelledEmail({
          to: bookerTo,
          clientName: target.name,
          bookerName: next.booker_name ?? prev.booker_name,
          appointment: next,
        });
      }
    } else if (next.status === "scheduled" && timesChanged) {
      void trySendAppointmentUpdatedEmail({
        to: target.email,
        clientName: target.name,
        appointment: next,
      });
      if (bookerTo) {
        void trySendBookerAppointmentUpdatedEmail({
          to: bookerTo,
          clientName: target.name,
          bookerName: next.booker_name ?? prev.booker_name,
          appointment: next,
        });
      }
    }

    return NextResponse.json({ ok: true, appointment: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onbekende fout";
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
