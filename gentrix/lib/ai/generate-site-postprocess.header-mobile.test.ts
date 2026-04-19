import { describe, expect, it } from "vitest";
import { repairHeaderMobileMenuButton } from "@/lib/ai/generate-site-postprocess";

describe("repairHeaderMobileMenuButton", () => {
  it("vult lege hamburger + @click bij top-sheet (geen side-drawer)", () => {
    const html = `<header x-data="{ navOpen: false }" class="fixed top-0 z-50 bg-white">
  <div class="flex justify-between h-16">
    <a href="#top">MOSHAM</a>
    <nav class="hidden lg:flex"><a href="#a">A</a></nav>
    <button type="button" class="lg:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5" aria-label="Menu"></button>
  </div>
  <div class="lg:hidden bg-stone-900" x-show="navOpen" x-cloak><nav aria-label="Mobiel menu"><a href="#a">A</a></nav></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toContain("@click");
    expect(out).toContain("navOpen = !navOpen");
    expect(out).toContain("gentrix-hamburger-fallback");
    expect(out).toContain("bg-neutral-900");
  });

  it("wijzigt geen knop die al inhoud en @click heeft", () => {
    const html = `<header x-data="{ navOpen: false }"><button type="button" class="lg:hidden" aria-label="Menu" @click="navOpen = !navOpen"><span>☰</span></button></header>`;
    expect(repairHeaderMobileMenuButton(html)).toBe(html);
  });
});
