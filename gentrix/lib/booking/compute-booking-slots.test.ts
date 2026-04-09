import { describe, expect, it } from "vitest";
import { DEFAULT_BOOKING_SETTINGS } from "@/lib/booking/booking-settings";
import {
  computeBookingSlotsForDay,
  filterBookingSlotsByPublicRoster,
  mergeBusyIntervals,
} from "@/lib/booking/compute-booking-slots";

describe("computeBookingSlotsForDay", () => {
  it("genereert slots op een maandag binnen openingsuren", () => {
    const settings = { ...DEFAULT_BOOKING_SETTINGS, leadTimeMinutes: 0, slotDurationMinutes: 60 };
    const busy: { startMs: number; endMs: number }[] = [];
    const monday = "2026-04-06";
    const noon = new Date(`${monday}T12:00:00Z`).getTime();
    const slots = computeBookingSlotsForDay(settings, monday, noon, busy);
    expect(slots.length).toBeGreaterThan(0);
    const first = slots[0];
    expect(new Date(first.starts_at).getTime()).toBeLessThan(new Date(first.ends_at).getTime());
  });

  it("geeft geen slots op zaterdag met default week (alleen ma–vr)", () => {
    const settings = DEFAULT_BOOKING_SETTINGS;
    const busy: { startMs: number; endMs: number }[] = [];
    const saturday = "2026-04-11";
    const noon = new Date(`${saturday}T12:00:00Z`).getTime();
    const slots = computeBookingSlotsForDay(settings, saturday, noon, busy);
    expect(slots.length).toBe(0);
  });
});

describe("mergeBusyIntervals", () => {
  it("voegt overlappende intervallen samen", () => {
    const m = mergeBusyIntervals([
      { startMs: 0, endMs: 100 },
      { startMs: 50, endMs: 150 },
    ]);
    expect(m).toEqual([{ startMs: 0, endMs: 150 }]);
  });
});

describe("filterBookingSlotsByPublicRoster", () => {
  it("laat alleen slots binnen roster-windows door", () => {
    const slots = [
      { starts_at: new Date(1000).toISOString(), ends_at: new Date(2000).toISOString() },
      { starts_at: new Date(5000).toISOString(), ends_at: new Date(6000).toISOString() },
    ];
    const roster = { kind: "windows" as const, windows: [{ startMs: 900, endMs: 2100 }] };
    const out = filterBookingSlotsByPublicRoster(slots, roster);
    expect(out).toHaveLength(1);
    expect(out[0]!.starts_at).toBe(slots[0]!.starts_at);
  });

  it("geeft geen slots bij roster closed", () => {
    const slots = [{ starts_at: new Date(1000).toISOString(), ends_at: new Date(2000).toISOString() }];
    const out = filterBookingSlotsByPublicRoster(slots, { kind: "closed" });
    expect(out).toHaveLength(0);
  });
});
