import type { BookingSettings } from "@/lib/booking/booking-settings";
import {
  computeBookingSlotsForDay,
  filterBookingSlotsByPublicRoster,
  getBookingDayBoundsMs,
  type BookingSlot,
} from "@/lib/booking/compute-booking-slots";
import { loadPublicDayRosterForClient, loadPublicDayRosterForStaffMember } from "@/lib/booking/load-day-roster-for-public-booking";
import { loadScheduledAppointmentsBusy } from "@/lib/booking/load-appointments-busy";

const PAD_MS = 2 * 60 * 60 * 1000;

/**
 * Publieke boek-slots voor één dag, optioneel gefilterd op medewerker (rooster + drukte).
 */
export async function computePublicBookingSlotsForDay(params: {
  clientId: string;
  settings: BookingSettings;
  dateYmd: string;
  nowMs: number;
  staffId?: string | null;
  /** Slotlengte in minuten (behandeling); anders uit agenda-instellingen. */
  slotDurationMinutes?: number;
}): Promise<BookingSlot[]> {
  const bounds = getBookingDayBoundsMs(params.dateYmd, params.settings.timeZone);
  if (!bounds) return [];

  const busy = await loadScheduledAppointmentsBusy(
    params.clientId,
    new Date(bounds.startMs - PAD_MS).toISOString(),
    new Date(bounds.endMs + PAD_MS).toISOString(),
    params.staffId ? { staffId: params.staffId } : undefined,
  );

  const base = computeBookingSlotsForDay(params.settings, params.dateYmd, params.nowMs, busy, {
    slotDurationMinutes: params.slotDurationMinutes,
  });

  const roster = params.staffId
    ? await loadPublicDayRosterForStaffMember(
        params.clientId,
        params.staffId,
        params.dateYmd,
        params.settings.timeZone,
      )
    : await loadPublicDayRosterForClient(params.clientId, params.dateYmd, params.settings.timeZone);

  return filterBookingSlotsByPublicRoster(base, roster);
}
