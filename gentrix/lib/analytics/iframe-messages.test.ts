import { describe, expect, it } from "vitest";
import { GENTRIX_IFRAME_ANALYTICS_SOURCE, isGentrixIframeToParentMessage } from "@/lib/analytics/iframe-messages";

describe("isGentrixIframeToParentMessage", () => {
  it("accepteert ready", () => {
    expect(
      isGentrixIframeToParentMessage({
        source: GENTRIX_IFRAME_ANALYTICS_SOURCE,
        type: "gentrix_iframe_ready",
        page_path: "/site/x",
      }),
    ).toBe(true);
  });

  it("accepteert scroll", () => {
    expect(
      isGentrixIframeToParentMessage({
        source: GENTRIX_IFRAME_ANALYTICS_SOURCE,
        type: "gentrix_site_scroll",
        depth_pct: 25,
        page_path: "/site/x?token=1",
      }),
    ).toBe(true);
  });

  it("wijst vreemde source af", () => {
    expect(
      isGentrixIframeToParentMessage({
        source: "other",
        type: "gentrix_iframe_ready",
        page_path: "/",
      }),
    ).toBe(false);
  });
});
