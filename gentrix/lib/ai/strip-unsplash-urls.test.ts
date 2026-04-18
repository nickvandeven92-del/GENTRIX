import { describe, expect, it } from "vitest";
import {
  htmlMayContainUnsplashPhotoUrl,
  replaceOverflowUnsplashRanges,
  stripAllUnsplashPhotoUrlsInHtml,
} from "@/lib/ai/strip-unsplash-urls";

describe("strip-unsplash-urls", () => {
  it("htmlMayContainUnsplashPhotoUrl", () => {
    expect(htmlMayContainUnsplashPhotoUrl('<img src="https://images.unsplash.com/photo-1?w=1" />')).toBe(true);
    expect(htmlMayContainUnsplashPhotoUrl("<section class='bg-zinc-900'>alleen tekst</section>")).toBe(false);
  });

  it("stripAllUnsplashPhotoUrlsInHtml verwijdert photo-URL", () => {
    const u = "https://images.unsplash.com/photo-111?w=1";
    const out = stripAllUnsplashPhotoUrlsInHtml(`<img src="${u}" alt="x">`);
    expect(out).not.toContain("images.unsplash.com");
  });

  it("replaceOverflowUnsplashRanges vervangt door placeholder", () => {
    const u = "https://images.unsplash.com/photo-999?w=1";
    const html = `bg-[url('${u}')]`;
    const idx = html.indexOf(u);
    const out = replaceOverflowUnsplashRanges(html, [{ start: idx, end: idx + u.length }]);
    expect(out).not.toContain("images.unsplash.com");
  });
});
