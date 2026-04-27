import { describe, expect, it } from "vitest";
import { ensurePublicSiteAnalyticsDataAttributesOnHtml } from "@/lib/site/ensure-public-site-analytics-attrs";

describe("ensurePublicSiteAnalyticsDataAttributesOnHtml", () => {
  it("voegt data-analytics toe aan module-ankers", () => {
    const html = '<a href="/winkel" data-studio-module="webshop" class="btn">Shop</a>';
    const out = ensurePublicSiteAnalyticsDataAttributesOnHtml(html);
    expect(out).toContain("data-analytics=");
    expect(out).toContain("module:webshop");
  });

  it("herhaalt geen attribuut", () => {
    const html = '<a data-analytics="x" href="/" data-studio-module="webshop">x</a>';
    const out = ensurePublicSiteAnalyticsDataAttributesOnHtml(html);
    expect((out.match(/data-analytics/g) ?? []).length).toBe(1);
  });
});
