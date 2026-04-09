import { NextResponse } from "next/server";
import { formatDateKeyAmsterdam, tomorrowDateKeyAmsterdam } from "@/lib/appointments/reminder-date";
import { trySendBookerAppointmentReminderEmail, type AppointmentEmailRow } from "@/lib/email/appointment-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Dagelijkse herinneringen (1 kalenderdag van tevoren, tijdzone Europe/Amsterdam).
 * Beveiliging: Authorization: Bearer $CRON_SECRET (Vercel Cron).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const horizon = new Date(now.getTime() + 50 * 60 * 60 * 1000);
  const targetDay = tomorrowDateKeyAmsterdam(now);

  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("client_appointments")
    .select(
      "id, client_id, title, starts_at, ends_at, status, notes, booker_name, booker_email, booker_wants_reminder, reminder_sent_at",
    )
    .eq("status", "scheduled")
    .eq("booker_wants_reminder", true)
    .not("booker_email", "is", null)
    .is("reminder_sent_at", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", horizon.toISOString());

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  const clientIds = [...new Set(list.map((r) => (r as { client_id: string }).client_id))];
  let clientRows: { id: string; name: string }[] = [];
  if (clientIds.length > 0) {
    const r = await supabase.from("clients").select("id, name").in("id", clientIds);
    clientRows = (r.data ?? []) as { id: string; name: string }[];
  }
  const nameById = new Map(clientRows.map((c) => [c.id, c.name?.trim() || "Zaak"]));

  let sent = 0;

  for (const raw of list) {
    const row = raw as {
      id: string;
      client_id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      status: string;
      notes: string | null;
      booker_name: string | null;
      booker_email: string | null;
      booker_wants_reminder: boolean;
      reminder_sent_at: string | null;
    };

    const apptDay = formatDateKeyAmsterdam(row.starts_at);
    if (apptDay !== targetDay) continue;

    const bookerTo = row.booker_email?.trim();
    if (!bookerTo) continue;

    const clientName = nameById.get(row.client_id) ?? "Zaak";

    const appointment = row as unknown as AppointmentEmailRow;
    const mailed = await trySendBookerAppointmentReminderEmail({
      to: bookerTo,
      clientName,
      bookerName: row.booker_name,
      appointment,
    });

    if (!mailed) continue;

    const { error: upErr } = await supabase
      .from("client_appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("reminder_sent_at", null);

    if (!upErr) sent += 1;
  }

  return NextResponse.json({ ok: true, targetDay, candidates: list.length, sent });
}
