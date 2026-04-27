import { describe, expect, it } from "vitest";
import { inferAnalyticsElementRoleFromId } from "@/lib/analytics/infer-analytics-element-role";

describe("inferAnalyticsElementRoleFromId", () => {
  it("mapt nav- en CTA-prefixen", () => {
    expect(inferAnalyticsElementRoleFromId("nav:link:home")).toBe("nav_link");
    expect(inferAnalyticsElementRoleFromId("nav:cta:book")).toBe("nav_cta");
    expect(inferAnalyticsElementRoleFromId("hero:primary")).toBe("hero_cta");
    expect(inferAnalyticsElementRoleFromId("section:contact:btn_1")).toBe("section_cta");
    expect(inferAnalyticsElementRoleFromId("webshop:product_tile:abc")).toBe("product_tile");
  });
});
