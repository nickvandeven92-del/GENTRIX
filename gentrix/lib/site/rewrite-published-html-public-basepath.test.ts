import { describe, expect, it } from "vitest";
import { rewritePublishedHtmlToPrettyPublicUrls } from "@/lib/site/rewrite-published-html-public-basepath";

describe("rewritePublishedHtmlToPrettyPublicUrls", () => {
  it("vervangt `/site/home/werkwijze` door `/werkwijze` in href-attribuut", () => {
    const html = `<a href="/site/home/werkwijze">Werkwijze</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(`<a href="/werkwijze">Werkwijze</a>`);
  });

  it("vervangt `/site/home` (landing) door `/`", () => {
    const html = `<a href="/site/home">Home</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(`<a href="/">Home</a>`);
  });

  it("behoudt hash en query bij rewrite", () => {
    const html = `<a href="/site/home/werkwijze?utm=x#services">x</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(`<a href="/werkwijze?utm=x#services">x</a>`);
  });

  it("vervangt ook absolute URL's met matching origin", () => {
    const html = `<a href="https://www.gentrix.nl/site/home/werkwijze">x</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, {
      slug: "home",
      pageOrigin: "https://www.gentrix.nl",
    });
    expect(out).toBe(`<a href="https://www.gentrix.nl/werkwijze">x</a>`);
  });

  it("laat links naar andere slugs ongemoeid", () => {
    const html = `<a href="/site/andere-slug/contact">x</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(html);
  });

  it("laat niet-href voorkomens van /site/{slug}/... staan (bv. in JS config)", () => {
    const html = `<script>var x="/site/home/werkwijze";</script><a href="/site/home/werkwijze">x</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(`<script>var x="/site/home/werkwijze";</script><a href="/werkwijze">x</a>`);
  });

  it("werkt met enkele quotes", () => {
    const html = `<a href='/site/home/contact'>C</a>`;
    const out = rewritePublishedHtmlToPrettyPublicUrls(html, { slug: "home" });
    expect(out).toBe(`<a href='/contact'>C</a>`);
  });
});
