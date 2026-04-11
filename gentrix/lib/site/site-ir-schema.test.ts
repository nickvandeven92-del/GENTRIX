import { describe, expect, it } from "vitest";
import { SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE } from "@/lib/site/site-blueprint-registry";
import { buildSiteIrV1, ensureSiteIrStandardModuleRoutes, siteIrV1Schema } from "@/lib/site/site-ir-schema";

describe("buildSiteIrV1", () => {
  it("zet default blueprint en module-slots", () => {
    const ir = buildSiteIrV1();
    expect(ir.schemaVersion).toBe(1);
    expect(ir.blueprintId).toBe(SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE);
    expect(ir.primaryPage.routeKey).toBe("public_landing");
    expect(ir.activeRoutes).toEqual(["public_landing", "public_contact", "public_booking", "public_shop"]);
    expect(ir.routes?.map((r) => r.routeKey)).toEqual([
      "public_landing",
      "public_contact",
      "public_booking",
      "public_shop",
    ]);
    expect(ir.moduleSlots.length).toBeGreaterThanOrEqual(1);
  });

  it("kan contact-route uitzetten voor legacy one-pager payload; booking/shop blijven capability", () => {
    const ir = buildSiteIrV1({ hasDedicatedContactPage: false });
    expect(ir.activeRoutes).toEqual(["public_landing", "public_booking", "public_shop"]);
    expect(ir.routes?.map((r) => r.routeKey)).toEqual(["public_landing", "public_booking", "public_shop"]);
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

  it("ensureSiteIrStandardModuleRoutes vult ontbrekende booking/shop-routes in oude IR", () => {
    const base = buildSiteIrV1({ hasDedicatedContactPage: false });
    const stripped = siteIrV1Schema.parse({
      ...base,
      activeRoutes: ["public_landing"],
      routes: base.routes?.filter((r) => r.routeKey === "public_landing") ?? [],
    });
    const fixed = ensureSiteIrStandardModuleRoutes(stripped);
    expect(fixed.activeRoutes).toEqual(["public_landing", "public_booking", "public_shop"]);
    expect(fixed.routes?.some((r) => r.routeKey === "public_booking")).toBe(true);
    expect(fixed.routes?.some((r) => r.routeKey === "public_shop")).toBe(true);
  });
});
