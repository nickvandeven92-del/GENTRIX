import { describe, expect, it } from "vitest";
import { isLeisureFamilyActivityBriefing } from "@/lib/ai/prompt-leisure-activity";

describe("isLeisureFamilyActivityBriefing", () => {
  it("detecteert watersport / zwemmen", () => {
    expect(isLeisureFamilyActivityBriefing("Watersportcentrum met glijbaan en zwembad")).toBe(true);
    expect(isLeisureFamilyActivityBriefing("Aqua splash zwemmen")).toBe(true);
  });

  it("is false voor generieke KMO zonder leisure", () => {
    expect(isLeisureFamilyActivityBriefing("Administratiekantoor voor zzp")).toBe(false);
  });
});
