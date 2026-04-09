import { z } from "zod";

const hm = z.string().regex(/^\d{2}:\d{2}$/, "Verwacht HH:mm");

export const bookingDayIntervalSchema = z.object({
  start: hm,
  end: hm,
});

/** Max. werkblokken per dag (ochtend + middag + evt. extra; gaten = pauze). */
export const BOOKING_MAX_INTERVALS_PER_DAY = 12;

export const bookingWeekDaySchema = z.object({
  /** ISO-8601: 1 = maandag … 7 = zondag */
  day: z.number().int().min(1).max(7),
  intervals: z.array(bookingDayIntervalSchema).max(BOOKING_MAX_INTERVALS_PER_DAY),
});

export const bookingSettingsSchema = z
  .object({
    timeZone: z.string().min(1).max(80).default("Europe/Amsterdam"),
    slotDurationMinutes: z.number().int().min(10).max(180).default(30),
    bufferMinutes: z.number().int().min(0).max(120).default(0),
    leadTimeMinutes: z.number().int().min(0).max(24 * 60).default(120),
    maxDaysAhead: z.number().int().min(1).max(120).default(60),
    week: z.array(bookingWeekDaySchema),
  })
  .strict();

export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

/** Standaard: ma–vr 09:00–17:00, 30 min slots, NL-tijd. */
export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timeZone: "Europe/Amsterdam",
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  leadTimeMinutes: 120,
  maxDaysAhead: 60,
  week: [1, 2, 3, 4, 5].map((day) => ({
    day,
    intervals: [{ start: "09:00", end: "17:00" }],
  })),
};

export function parseBookingSettings(raw: unknown): BookingSettings {
  if (raw == null) return DEFAULT_BOOKING_SETTINGS;
  const parsed = bookingSettingsSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_BOOKING_SETTINGS;
  return parsed.data;
}
