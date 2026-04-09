import type { BusyInterval } from "@/lib/booking/compute-booking-slots";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type LoadAppointmentsBusyOptions = {
  /** Alleen voor deze medewerker: telt ook `staff_id IS NULL` mee (legacy/pool-blokkades). */
  staffId?: string;
};

/**
 * Geplande afspraken die de gegeven periode raken (timestamptz).
 */
export async function loadScheduledAppointmentsBusy(
  clientId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  options?: LoadAppointmentsBusyOptions,
): Promise<BusyInterval[]> {
  const supabase = createServiceRoleClient();
  let q = supabase
    .from("client_appointments")
    .select("starts_at, ends_at, status, staff_id")
    .eq("client_id", clientId)
    .eq("status", "scheduled")
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso);

  if (options?.staffId) {
    q = q.or(`staff_id.eq.${options.staffId},staff_id.is.null`);
  }

  const { data, error } = await q;

  if (error || !data) return [];

  const out: BusyInterval[] = [];
  for (const row of data) {
    const s = new Date(String(row.starts_at)).getTime();
    const e = new Date(String(row.ends_at)).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    out.push({ startMs: s, endMs: e });
  }
  return out;
}
