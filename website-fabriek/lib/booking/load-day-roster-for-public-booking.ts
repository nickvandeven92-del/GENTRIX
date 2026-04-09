import type { BusyInterval, PublicDayRoster } from "@/lib/booking/compute-booking-slots";
import { getBookingDayBoundsMs, mergeBusyIntervals } from "@/lib/booking/compute-booking-slots";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/** Diensten met dit voorvoegsel in `notes` tellen niet mee voor publieke beschikbaarheid. */
const EXCLUDE_FROM_PUBLIC_ROSTER = /^\s*\[(afwezig|intern)\]/i;

/**
 * Bepaalt of er voor deze kalenderdag geplande werkdiensten zijn (actieve medewerkers).
 * - legacy: geen shifts → website gebruikt alleen vaste openingstijden uit instellingen.
 * - windows: er is minstens één mee-tellende werkdienst; slots worden afgekapt op de union daarvan
 *   (openingstijden blijven de buitenrand; alleen `[intern]` / `[afwezig]` in notes telt niet mee).
 */
export async function loadPublicDayRosterForClient(
  clientId: string,
  dateYmd: string,
  timeZone: string,
): Promise<PublicDayRoster> {
  const bounds = getBookingDayBoundsMs(dateYmd, timeZone);
  if (!bounds) return { kind: "legacy" };

  const supabase = createServiceRoleClient();
  const { data: staffRows, error: staffErr } = await supabase
    .from("client_staff")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (staffErr || !staffRows?.length) return { kind: "legacy" };

  const staffIds = staffRows.map((s) => s.id as string);
  const rangeStartIso = new Date(bounds.startMs).toISOString();
  const rangeEndIso = new Date(bounds.endMs).toISOString();

  const { data: shiftRows, error: shiftErr } = await supabase
    .from("client_staff_shifts")
    .select("starts_at, ends_at, notes")
    .eq("client_id", clientId)
    .in("staff_id", staffIds)
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso);

  if (shiftErr?.message?.includes("client_staff_shifts") || shiftErr?.code === "42P01") {
    return { kind: "legacy" };
  }
  if (shiftErr || !shiftRows?.length) return { kind: "legacy" };

  const windows: BusyInterval[] = [];
  for (const row of shiftRows) {
    if (EXCLUDE_FROM_PUBLIC_ROSTER.test(String(row.notes ?? ""))) continue;
    const s = new Date(String(row.starts_at)).getTime();
    const e = new Date(String(row.ends_at)).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const clipS = Math.max(s, bounds.startMs);
    const clipE = Math.min(e, bounds.endMs);
    if (clipE > clipS) windows.push({ startMs: clipS, endMs: clipE });
  }

  if (windows.length === 0) return { kind: "legacy" };
  return { kind: "windows", windows: mergeBusyIntervals(windows) };
}

/**
 * Roster voor één medewerker op één dag (publiek boeken).
 * - legacy: geen shifts ingevoerd → openingstijden gelden.
 * - closed: er zijn wel shifts, maar geen enkele boekbare (bijv. alleen [afwezig]/[intern]) → niet boekbaar.
 * - windows: minstens één boekbare dienst → slots binnen die union (doorsnede met openingstijden).
 */
export async function loadPublicDayRosterForStaffMember(
  clientId: string,
  staffId: string,
  dateYmd: string,
  timeZone: string,
): Promise<PublicDayRoster> {
  const bounds = getBookingDayBoundsMs(dateYmd, timeZone);
  if (!bounds) return { kind: "legacy" };

  const supabase = createServiceRoleClient();
  const staffCheck = await supabase
    .from("client_staff")
    .select("id")
    .eq("client_id", clientId)
    .eq("id", staffId)
    .eq("is_active", true)
    .maybeSingle();

  if (staffCheck.error || !staffCheck.data) return { kind: "closed" };

  const rangeStartIso = new Date(bounds.startMs).toISOString();
  const rangeEndIso = new Date(bounds.endMs).toISOString();

  const { data: shiftRows, error: shiftErr } = await supabase
    .from("client_staff_shifts")
    .select("starts_at, ends_at, notes")
    .eq("client_id", clientId)
    .eq("staff_id", staffId)
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso);

  if (shiftErr?.message?.includes("client_staff_shifts") || shiftErr?.code === "42P01") {
    return { kind: "legacy" };
  }
  if (shiftErr || !shiftRows?.length) return { kind: "legacy" };

  const windows: BusyInterval[] = [];
  for (const row of shiftRows) {
    if (EXCLUDE_FROM_PUBLIC_ROSTER.test(String(row.notes ?? ""))) continue;
    const s = new Date(String(row.starts_at)).getTime();
    const e = new Date(String(row.ends_at)).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const clipS = Math.max(s, bounds.startMs);
    const clipE = Math.min(e, bounds.endMs);
    if (clipE > clipS) windows.push({ startMs: clipS, endMs: clipE });
  }

  if (windows.length === 0) return { kind: "closed" };
  return { kind: "windows", windows: mergeBusyIntervals(windows) };
}
