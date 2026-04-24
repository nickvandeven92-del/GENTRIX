import { describe, expect, it } from "vitest";
import { addDefaultLazyLoadingToBelowFoldSectionImages } from "@/lib/site/html-img-lazy-default";

describe("addDefaultLazyLoadingToBelowFoldSectionImages", () => {
  it("voegt loading=lazy en decoding=async toe", () => {
    const out = addDefaultLazyLoadingToBelowFoldSectionImages(`<img src="/a.jpg" alt="">`);
    expect(out).toMatch(/loading="lazy"/);
    expect(out).toMatch(/decoding="async"/);
  });

  it("laat bestaand loading met rust", () => {
    const html = `<img loading="eager" src="/a.jpg" alt="">`;
    expect(addDefaultLazyLoadingToBelowFoldSectionImages(html)).toBe(html);
  });

  it("laat fetchpriority=high met rust", () => {
    const html = `<img fetchpriority="high" src="/a.jpg" alt="">`;
    expect(addDefaultLazyLoadingToBelowFoldSectionImages(html)).toBe(html);
  });
});
