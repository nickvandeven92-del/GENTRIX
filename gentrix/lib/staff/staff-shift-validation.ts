/** Maximaal vooruit plannen (maanden); gangbaar is 3–6 maanden — wij cappen op 6. */
export const STAFF_PLANNING_MAX_MONTHS = 6;

const MS_DAY = 86_400_000;

export function staffPlanningHorizonEnd(now = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() + STAFF_PLANNING_MAX_MONTHS);
  return d;
}

/** Sta kleine correcties in het verleden toe (weken). */
const PAST_WINDOW_DAYS = 21;

export type StaffShiftWindowError =
  | "invalid_range"
  | "ends_before_starts"
  | "too_far_past"
  | "beyond_horizon"
  | "too_long";

const MAX_SINGLE_SHIFT_HOURS = 16;

export function validateStaffShiftWindow(startsAt: Date, endsAt: Date, now = new Date()): StaffShiftWindowError | null {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return "invalid_range";
  if (endsAt <= startsAt) return "ends_before_starts";
  const pastLimit = new Date(now.getTime() - PAST_WINDOW_DAYS * MS_DAY);
  if (endsAt < pastLimit) return "too_far_past";
  const horizon = staffPlanningHorizonEnd(now);
  if (startsAt > horizon) return "beyond_horizon";
  const hours = (endsAt.getTime() - startsAt.getTime()) / (60 * 60 * 1000);
  if (hours > MAX_SINGLE_SHIFT_HOURS) return "too_long";
  return null;
}

export function staffShiftWindowErrorMessage(code: StaffShiftWindowError): string {
  switch (code) {
    case "invalid_range":
      return "Ongeldige datum/tijd.";
    case "ends_before_starts":
      return "Einde moet na start zijn.";
    case "too_far_past":
      return "Deze dienst ligt te ver in het verleden om nog te wijzigen.";
    case "beyond_horizon":
      return `Je kunt maximaal ${STAFF_PLANNING_MAX_MONTHS} maanden vooruit plannen.`;
    case "too_long":
      return "Een dienst mag maximaal 16 uur duren.";
    default:
      return "Ongeldige dienst.";
  }
}
