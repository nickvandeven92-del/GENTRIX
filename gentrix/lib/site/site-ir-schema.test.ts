import { describe, expect, it } from "vitest";
import { SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE } from "@/lib/site/site-blueprint-registry";
import { buildSiteIrV1, siteIrV1Schema } from "@/lib/site/site-ir-schema";

describe("buildSiteIrV1", () => {
  it("zet default blueprint en module-slots", () => {
    const ir = buildSiteIrV1();
    expect(ir.schemaVersion).toBe(1);
    expect(ir.blueprintId).toBe(SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE);
    expect(ir.primaryPage.routeKey).toBe("public_landing");
    expect(ir.moduleSlots.length).toBeGreaterThanOrEqual(1);
  });

  it("accepteert industry-id", () => {
    const ir = buildSiteIrV1({ detectedIndustryId: "barber" });
    expect(ir.detectedIndustryId).toBe("barber");
    expect(siteIrV1Schema.safeParse(ir).success).toBe(true);
  });

  it("accepteert sectionIdsOrdered", () => {
    const ir = buildSiteIrV1({ sectionIdsOrdered: ["hero", "footer"] });
    expect(ir.sectionIdsOrdered).toEqual(["hero", "footer"]);
    expect(siteIrV1Schema.safeParse(ir).success).toBe(true);
  });
});
