import { describe, expect, it } from "vitest";
import {
  collectMarketingNavScanHtml,
  marketingFaqHtmlHasDisclosurePattern,
  validateMarketingFaqLinkNotInHeader,
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

  it("does not require faq in nav when other keys are linked", () => {
    const nav =
      '<a href="__STUDIO_SITE_BASE__/wat-wij-doen">D</a><footer><a href="__STUDIO_SITE_BASE__/faq">FAQ</a></footer>';
    const pages = {
      faq: [
        { id: "a", html: "<section><details><summary>Q</summary><p>A</p></details></section>" },
        { id: "b", html: "<section>x</section>" },
      ],
      "wat-wij-doen": [
        { id: "c", html: "<section></section>" },
        { id: "d", html: "<section></section>" },
      ],
    };
    expect(validateMarketingPagePlanNavCoverage(pages, nav).valid).toBe(true);
  });
});

describe("validateMarketingFaqLinkNotInHeader", () => {
  it("passes when faq href is only outside header", () => {
    const html =
      '<header><nav><a href="__STUDIO_SITE_BASE__/wat-wij-doen">X</a></nav></header><footer><a href="__STUDIO_SITE_BASE__/faq">FAQ</a></footer>';
    const r = validateMarketingFaqLinkNotInHeader({ faq: [], "wat-wij-doen": [] }, html);
    expect(r.valid).toBe(true);
  });

  it("fails when faq link appears inside header", () => {
    const html = '<header><a href="__STUDIO_SITE_BASE__/faq">FAQ</a></header><footer></footer>';
    const r = validateMarketingFaqLinkNotInHeader({ faq: [] }, html);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/header/i);
  });
});

describe("marketingFaqHtmlHasDisclosurePattern", () => {
  it("detects native details/summary", () => {
    expect(
      marketingFaqHtmlHasDisclosurePattern(
        "<section><details><summary>Vraag</summary><p>Antwoord</p></details></section>",
      ),
    ).toBe(true);
  });

  it("detects Alpine-style accordion after header strip", () => {
    const h =
      '<header><nav>top</nav></header><div x-data="{open:null}"><button type="button" @click="open = open === 1 ? null : 1">q</button><div x-show="open === 1">antwoord</div></div>';
    expect(marketingFaqHtmlHasDisclosurePattern(h)).toBe(true);
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

  it("fails faq page without disclosure pattern", () => {
    const longText = "x".repeat(350);
    const pages = {
      faq: [
        { id: "a", html: `<section><h2>Vraag 1</h2><p>${longText}</p></section>` },
        { id: "b", html: `<section><h2>Vraag 2</h2><p>${longText}</p></section>` },
      ],
    };
    const r = validateMarketingPageContent(pages);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("inklapbaar") || e.includes("details"))).toBe(true);
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
