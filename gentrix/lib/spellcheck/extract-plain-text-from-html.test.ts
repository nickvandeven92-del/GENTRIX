import { describe, expect, it } from "vitest";
import { extractPlainTextFromHtml } from "@/lib/spellcheck/extract-plain-text-from-html";

describe("extractPlainTextFromHtml", () => {
  it("stript tags en houdt zichtbare tekst", () => {
    const html = `<div class="x"><p>Hallo <strong>wereld</strong>.</p></div>`;
    expect(extractPlainTextFromHtml(html)).toBe("Hallo wereld.");
  });

  it("verwijdert script en style", () => {
    const html = `<p>Ok</p><script>evil()</script><style>.a{}</style><p>nee</p>`;
    expect(extractPlainTextFromHtml(html)).toBe("Ok nee");
  });

  it("decodeert veelvoorkomende entities", () => {
    expect(extractPlainTextFromHtml(`Koffie &amp; thee`)).toBe("Koffie & thee");
  });
});
