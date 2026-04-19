import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { describe, expect, it } from "vitest";
import { describeTailwindMarketingNavPayloadIssues } from "@/lib/site/tailwind-marketing-nav-consistency";

const sec = (html: string): TailwindSection => ({ id: "x", sectionName: "Test", html });

describe("describeTailwindMarketingNavPayloadIssues", () => {
  it("returns null when no studio base marketing links", () => {
    expect(
      describeTailwindMarketingNavPayloadIssues({
        sections: [sec('<a href="/">home</a>')],
        marketingPages: undefined,
      }),
    ).toBeNull();
  });

  it("returns null when nav segments resolve via marketingPages", () => {
    expect(
      describeTailwindMarketingNavPayloadIssues({
        sections: [sec('<a href="__STUDIO_SITE_BASE__/wat-wij-doen">Diensten</a>')],
        marketingPages: {
          "wat-wij-doen": [sec("<p>ok</p>")],
        },
      }),
    ).toBeNull();
  });

  it("flags missing marketingPages when nav uses placeholders", () => {
    const msg = describeTailwindMarketingNavPayloadIssues({
      sections: [sec('<a href="__STUDIO_SITE_BASE__/over-ons">Over</a>')],
      marketingPages: undefined,
    });
    expect(msg).toContain("marketingPages");
    expect(msg).toContain("over-ons");
  });

  it("flags segment that does not resolve to any key", () => {
    const msg = describeTailwindMarketingNavPayloadIssues({
      sections: [sec('<a href="__STUDIO_SITE_BASE__/onbekend-pad">x</a>')],
      marketingPages: {
        "wat-wij-doen": [sec("<p>x</p>")],
      },
    });
    expect(msg).toContain("onbekend-pad");
  });

  it("ignores reserved segments like contact", () => {
    expect(
      describeTailwindMarketingNavPayloadIssues({
        sections: [sec('<a href="__STUDIO_SITE_BASE__/contact">c</a>')],
        marketingPages: undefined,
      }),
    ).toBeNull();
  });
});
