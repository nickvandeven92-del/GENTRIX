import { describe, expect, it } from "vitest";
import {
  enhanceTailwindHeroSectionHtmlForPublicDelivery,
  parseHeroLcpImagePreloadFromHtml,
} from "@/lib/site/tailwind-hero-public-delivery";

describe("parseHeroLcpImagePreloadFromHtml", () => {
  it("pakt eerste full-bleed supabase hero-img met srcset voor preload", () => {
    const src =
      "https://xx.supabase.co/storage/v1/object/public/site-assets/home/ai-hero/1776-abc/1280.webp";
    const html = enhanceTailwindHeroSectionHtmlForPublicDelivery(
      `<section id="hero"><img class="absolute inset-0 w-full h-full object-cover" src="${src}" alt=""/></section>`,
    );
    const d = parseHeroLcpImagePreloadFromHtml(html);
    expect(d).not.toBeNull();
    expect(d!.href).toContain("1280.webp");
    expect(d!.imageSrcSet).toBeTruthy();
    expect(d!.imageSizes).toBeTruthy();
  });
});
