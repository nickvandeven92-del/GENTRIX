import { describe, expect, it } from "vitest";
import { bookingIntervalsOverlap } from "@/lib/booking/validate-booking-intervals";

describe("bookingIntervalsOverlap", () => {
  it("false voor één blok", () => {
    expect(bookingIntervalsOverlap([{ start: "09:00", end: "17:00" }])).toBe(false);
  });

  it("false voor gat (pauze) tussen blokken", () => {
    expect(
      bookingIntervalsOverlap([
        { start: "09:00", end: "12:00" },
        { start: "13:00", end: "17:00" },
      ]),
    ).toBe(false);
  });

  it("true bij overlap", () => {
    expect(
      bookingIntervalsOverlap([
        { start: "09:00", end: "13:00" },
        { start: "12:00", end: "17:00" },
      ]),
    ).toBe(true);
  });
});
