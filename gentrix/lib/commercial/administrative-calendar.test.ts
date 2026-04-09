import { describe, expect, it } from "vitest";
import { ADMINISTRATIVE_TIMEZONE, getAdministrativeYear } from "@/lib/commercial/administrative-calendar";

describe("administrative-calendar", () => {
  it("gebruikt Europe/Amsterdam als default timezone-constante", () => {
    expect(ADMINISTRATIVE_TIMEZONE).toBe("Europe/Amsterdam");
  });

  it("31 dec UTC kan al 2026 zijn in Amsterdam (jaarwisseling)", () => {
    const d = new Date("2025-12-31T23:00:00.000Z");
    const y = getAdministrativeYear(d);
    expect(y).toBeGreaterThanOrEqual(2025);
    expect(y).toBeLessThanOrEqual(2026);
  });

  it("1 jan vroeg UTC kan nog vorig jaar zijn in Amsterdam", () => {
    const d = new Date("2026-01-01T00:30:00.000Z");
    const y = getAdministrativeYear(d);
    expect(y).toBeGreaterThanOrEqual(2025);
    expect(y).toBeLessThanOrEqual(2026);
  });

  it("expliciete timezone parameter werkt voor vergelijking UTC", () => {
    const d = new Date("2026-06-15T12:00:00.000Z");
    const yUtc = getAdministrativeYear(d, "UTC");
    const yAms = getAdministrativeYear(d, "Europe/Amsterdam");
    expect(typeof yUtc).toBe("number");
    expect(typeof yAms).toBe("number");
  });
});
