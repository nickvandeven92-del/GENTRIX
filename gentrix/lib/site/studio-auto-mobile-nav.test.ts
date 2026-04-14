import { describe, expect, it } from "vitest";
import { shouldInjectStudioAutoMobileNav } from "@/lib/site/studio-auto-mobile-nav";

describe("shouldInjectStudioAutoMobileNav", () => {
  it("injecteert niet als het model menuOpen (i.p.v. navOpen) in x-data gebruikt", () => {
    const html = `
      <header x-data="{ menuOpen: false }" class="fixed inset-x-0 top-0 z-50">
        <button type="button" class="md:hidden">Menu</button>
      </header>
      <section>…</section>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert niet bij een mobiele menuknop met md:hidden", () => {
    const html = `
      <header class="fixed top-0 z-50 w-full">
        <button type="button" class="inline-flex md:hidden" aria-label="Open menu">☰</button>
      </header>`;
    expect(shouldInjectStudioAutoMobileNav(html)).toBe(false);
  });

  it("injecteert nog wel als er geen header en geen patroon is (lege one-pager)", () => {
    expect(shouldInjectStudioAutoMobileNav(`<section><p>Alleen tekst</p></section>`)).toBe(true);
  });
});
