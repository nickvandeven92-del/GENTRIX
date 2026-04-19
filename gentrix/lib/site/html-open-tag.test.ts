import { describe, expect, it } from "vitest";
import { findHtmlOpenTagEnd, replaceAllOpenTagsByLocalName } from "@/lib/site/html-open-tag";

describe("findHtmlOpenTagEnd", () => {
  it("finds end of a simple img tag", () => {
    const html = '<img src="a.png" class="x">';
    expect(html.slice(0, findHtmlOpenTagEnd(html, 0))).toBe('<img src="a.png" class="x">');
  });

  it("does not stop at > inside a double-quoted class (Tailwind arbitrary)", () => {
    const html = '<img class="before:content-[\'>\']" src="https://x.com/a.png" />tail';
    const end = findHtmlOpenTagEnd(html, 0);
    expect(html.slice(0, end)).toBe('<img class="before:content-[\'>\']" src="https://x.com/a.png" />');
    expect(html.slice(end)).toBe("tail");
  });
});

describe("replaceAllOpenTagsByLocalName", () => {
  it("replaces full img tags when attributes contain > in quotes", () => {
    const html = '<div><img class="z-[10]" src="https://ex.com/a.png" />X</div>';
    const out = replaceAllOpenTagsByLocalName(html, "img", () => "");
    expect(out).toBe("<div>X</div>");
  });
});
