import { describe, expect, it } from "vitest";
import { staffPlanningHorizonEnd, validateStaffShiftWindow } from "./staff-shift-validation";

describe("validateStaffShiftWindow", () => {
  it("accepts a one-hour shift within horizon", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const starts = new Date("2026-02-01T09:00:00.000Z");
    const ends = new Date("2026-02-01T10:00:00.000Z");
    expect(validateStaffShiftWindow(starts, ends, now)).toBeNull();
  });

  it("rejects start beyond horizon", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const horizon = staffPlanningHorizonEnd(now);
    const starts = new Date(horizon.getTime() + 60_000);
    const ends = new Date(starts.getTime() + 3_600_000);
    expect(validateStaffShiftWindow(starts, ends, now)).toBe("beyond_horizon");
  });
});
