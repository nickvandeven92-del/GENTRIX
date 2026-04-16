import { describe, expect, it } from "vitest";
import {
  collectMarketingNavScanHtml,
  validateMarketingPageContent,
  validateMarketingPageLinks,
  validateMarketingPagePlanNavCoverage,
} from "@/lib/ai/validate-marketing-pages";

describe("validateMarketingPageLinks", () => {
  it("fails when nav links to a slug missing from marketingPages", () => {
    const nav = '<a href="__STUDIO_SITE_BASE__/over-ons">Over</a>';
    const pages = { faq: [{ id: "x", html: "<section></section>" }] };
    const r = validateMarketingPageLinks(nav, pages);
    expect(r.valid).toBe(false);
    expect(r.missingKeys).toContain("over-ons");
  });

  it("passes when every nav slug exists in marketingPages", () => {
    const nav =
      '<a href="__STUDIO_SITE_BASE__/faq">F</a><a href = "__STUDIO_SITE_BASE__/wat-wij-doen">W</a>';
    const pages = {
      faq: [
        { id: "a", html: "<section>x</section>" },
        { id: "b", html: "<section>y</section>" },
      ],
      "wat-wij-doen": [
        { id: "c", html: "<section>z</section>" },
        { id: "d", html: "<section>w</section>" },
      ],
    };
    expect(validateMarketingPageLinks(nav, pages).valid).toBe(true);
  });
});

describe("validateMarketingPagePlanNavCoverage", () => {
  it("fails when a marketing key has no __STUDIO_SITE_BASE__ link in nav", () => {
    const nav = '<a href="__STUDIO_SITE_BASE__/faq">FAQ</a>';
    const pages = {
      faq: [{ id: "a", html: "<section></section>" }, { id: "b", html: "<section></section>" }],
      "wat-wij-doen": [{ id: "c", html: "<section></section>" }, { id: "d", html: "<section></section>" }],
    };
    const r = validateMarketingPagePlanNavCoverage(pages, nav);
    expect(r.valid).toBe(false);
    expect(r.missingInNav).toContain("wat-wij-doen");
  });
});

describe("validateMarketingPageContent", () => {
  it("fails when a page has fewer than 2 sections", () => {
    const pages = {
      faq: [{ id: "only", html: "<section>".padEnd(400, "x") + "</section>" }],
    };
    const r = validateMarketingPageContent(pages);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("minimaal 2 secties"))).toBe(true);
  });
});

describe("collectMarketingNavScanHtml", () => {
  it("joins landing, marketing and contact html", () => {
    const html = collectMarketingNavScanHtml({
      sections: [{ html: "A" }],
      marketingPages: { faq: [{ html: "B" }] },
      contactSections: [{ html: "C" }],
    });
    expect(html).toBe("A\nB\nC");
  });
});
