import { describe, expect, it } from "vitest";
import {
  htmlMayContainHallucinatedStockPhotoUrl,
  replaceOverflowHallucinatedStockPhotoRanges,
  stripHallucinatedStockPhotoUrlsInHtml,
} from "@/lib/ai/strip-hallucinated-stock-photo-urls";

describe("strip-hallucinated-stock-photo-urls", () => {
  it("htmlMayContainHallucinatedStockPhotoUrl", () => {
    expect(
      htmlMayContainHallucinatedStockPhotoUrl('<img src="https://images.unsplash.com/photo-1?w=1" />'),
    ).toBe(true);
    expect(htmlMayContainHallucinatedStockPhotoUrl("<section class='bg-zinc-900'>alleen tekst</section>")).toBe(
      false,
    );
  });

  it("stripHallucinatedStockPhotoUrlsInHtml verwijdert photo-URL", () => {
    const u = "https://images.unsplash.com/photo-111?w=1";
    const out = stripHallucinatedStockPhotoUrlsInHtml(`<img src="${u}" alt="x">`);
    expect(out).not.toContain("images.unsplash.com");
  });

  it("replaceOverflowHallucinatedStockPhotoRanges vervangt door placeholder", () => {
    const u = "https://images.unsplash.com/photo-999?w=1";
    const html = `<img src="${u}" alt="x">`;
    const idx = html.indexOf(u);
    const out = replaceOverflowHallucinatedStockPhotoRanges(html, [{ start: idx, end: idx + u.length }]);
    expect(out).not.toContain("images.unsplash.com");
  });
});
