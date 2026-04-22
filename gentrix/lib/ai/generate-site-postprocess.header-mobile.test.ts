import { describe, expect, it } from "vitest";
import {
  buildGentrixMenuIconToggle,
  repairHeaderMobileMenuButton,
} from "@/lib/ai/generate-site-postprocess";

describe("buildGentrixMenuIconToggle", () => {
  it("bouwt twee-staten toggle met x-show en x-cloak op de X", () => {
    const html = buildGentrixMenuIconToggle("navOpen");
    expect(html).toContain(`x-show="!navOpen"`);
    expect(html).toContain(`x-show="navOpen"`);
    expect(html).toContain("x-cloak");
    expect(html).toContain("rotate-45");
    expect(html).toContain("-rotate-45");
    expect(html).toContain("gentrix-menu-icon");
    expect(html).toContain("bg-current");
  });

  it("respecteert de gegeven stateKey", () => {
    const html = buildGentrixMenuIconToggle("menuOpen");
    expect(html).toContain(`x-show="!menuOpen"`);
    expect(html).toContain(`x-show="menuOpen"`);
    expect(html).not.toContain("navOpen");
  });
});

describe("repairHeaderMobileMenuButton", () => {
  it("vult lege hamburger + @click + premium dual-state icoon bij top-sheet", () => {
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
    expect(out).toContain("gentrix-menu-icon");
    expect(out).toContain(`x-show="!navOpen"`);
    expect(out).toContain(`x-show="navOpen"`);
    expect(out).toContain("rotate-45");
    // text-neutral-900 moet *binnen* class="..." op de button landen (niet als bare attribute)
    expect(out).toMatch(/<button\b[^>]*\bclass="[^"]*\btext-neutral-900\b[^"]*"[^>]*>/);
  });

  it("vervangt een statisch ☰-icoon in een knop met @click door de dual-state toggle", () => {
    const html = `<header x-data="{ navOpen: false }" class="bg-white">
  <button type="button" class="lg:hidden w-10 h-10" aria-label="Menu" @click="navOpen = !navOpen"><span>☰</span></button>
  <div class="lg:hidden" x-show="navOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toContain("gentrix-menu-icon");
    expect(out).toContain(`x-show="!navOpen"`);
    expect(out).toContain(`x-show="navOpen"`);
    expect(out).not.toContain("☰");
    // Bestaande @click moet behouden blijven — geen dubbele @click regel
    expect((out.match(/@click/g) ?? []).length).toBe(1);
  });

  it("vervangt een enkel-state svg-icoon zonder mirrorende x-show door dual-state toggle", () => {
    const html = `<header x-data="{ navOpen: false }" class="bg-stone-900">
  <button type="button" class="lg:hidden w-10 h-10 text-white" aria-label="Menu" @click="navOpen = !navOpen"><svg class="h-6 w-6" viewBox="0 0 24 24"><path d="M4 6h16"/></svg></button>
  <div class="lg:hidden" x-show="navOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toContain("gentrix-menu-icon");
    expect(out).toContain(`x-show="!navOpen"`);
    expect(out).toContain(`x-show="navOpen"`);
    expect(out).not.toContain("<path");
  });

  it("laat een knop met al-correcte dual-state x-show toggle ongewijzigd", () => {
    const html = `<header x-data="{ navOpen: false }"><button type="button" class="lg:hidden" aria-label="Menu" @click="navOpen = !navOpen"><span x-show="!navOpen">open</span><span x-show="navOpen" x-cloak>close</span></button></header>`;
    expect(repairHeaderMobileMenuButton(html)).toBe(html);
  });

  it("is idempotent: een tweede run verandert niets meer", () => {
    const html = `<header x-data="{ navOpen: false }" class="bg-white">
  <button type="button" class="lg:hidden w-10 h-10" aria-label="Menu"></button>
  <div class="lg:hidden" x-show="navOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const first = repairHeaderMobileMenuButton(html);
    const second = repairHeaderMobileMenuButton(first);
    expect(second).toBe(first);
  });

  it("detecteert alternatieve stateKey (menuOpen) en genereert toggle op diezelfde key", () => {
    const html = `<header x-data="{ menuOpen: false }" class="bg-white">
  <button type="button" class="lg:hidden w-10 h-10" aria-label="Menu" @click="menuOpen = !menuOpen"><span>☰</span></button>
  <div class="lg:hidden" x-show="menuOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toContain(`x-show="!menuOpen"`);
    expect(out).toContain(`x-show="menuOpen"`);
    expect(out).not.toContain("navOpen");
  });
});
