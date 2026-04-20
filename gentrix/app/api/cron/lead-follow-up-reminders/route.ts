import { NextResponse } from "next/server";
import { formatDateKeyAmsterdam } from "@/lib/appointments/reminder-date";
import {
  alignReminderStateToAnchor,
  buildFollowUpReminderNoteLine,
  diffCalendarDaysYmd,
  prependLeadNote,
  tierForDiffDays,
} from "@/lib/sales-os/lead-follow-up-reminders";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type LeadRow = {
  id: string;
  notes: string | null;
  next_follow_up_at: string;
  status: string;
  follow_up_reminder_state: unknown;
};

/**
 * Dagelijkse notities bij leads: 3 dagen, 1 dag en op de dag zelf vóór geplande follow-up
 * (kalenderdagen Europe/Amsterdam). Beveiliging: Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayYmd = formatDateKeyAmsterdam(now);

  const supabase = createServiceRoleClient();
  const { data: rawRows, error } = await supabase
    .from("sales_leads")
    .select("id, notes, next_follow_up_at, status, follow_up_reminder_state")
    .not("next_follow_up_at", "is", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = ((rawRows ?? []).filter(
    (r) => !["lost", "converted"].includes((r as LeadRow).status),
  )) as unknown as LeadRow[];
  let updated = 0;

  for (const lead of rows) {
    const due = lead.next_follow_up_at;
    if (!due) continue;

    const followUpYmd = formatDateKeyAmsterdam(due);
    const diff = diffCalendarDaysYmd(todayYmd, followUpYmd);
    if (diff < 0) continue;

    const tier = tierForDiffDays(diff);
    if (!tier) continue;

    let state = alignReminderStateToAnchor(lead.follow_up_reminder_state, due);
    if (state.fired.includes(tier)) continue;

    const line = buildFollowUpReminderNoteLine(tier, due, now);
    const newNotes = prependLeadNote(lead.notes, line);
    state = { ...state, fired: [...state.fired, tier] };

    const { error: upErr } = await supabase
      .from("sales_leads")
      .update({
        notes: newNotes,
        follow_up_reminder_state: state,
      })
      .eq("id", lead.id);

    if (!upErr) {
      updated += 1;
      lead.notes = newNotes;
      lead.follow_up_reminder_state = state;
    }
  }

  return NextResponse.json({ ok: true, todayYmd, candidates: rows.length, notesAppended: updated });
}
