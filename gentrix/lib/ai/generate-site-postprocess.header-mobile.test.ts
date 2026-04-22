import { describe, expect, it } from "vitest";
import {
  buildGentrixMenuIconToggle,
  convertMobileDrawerToPushDown,
  repairHeaderMobileMenuButton,
} from "@/lib/ai/generate-site-postprocess";

describe("buildGentrixMenuIconToggle", () => {
  it("bouwt twee SVG-staten (hamburger + X) met x-show en x-cloak op de X", () => {
    const html = buildGentrixMenuIconToggle("navOpen");
    expect(html).toContain(`x-show="!navOpen"`);
    expect(html).toContain(`x-show="navOpen"`);
    expect(html).toContain("x-cloak");
    expect(html).toContain("gentrix-menu-icon");
    expect(html).toContain("<svg");
    expect(html).toContain(`stroke="currentColor"`);
    // 3 streepjes voor de hamburger + 2 diagonalen voor de X = 5 lines
    expect((html.match(/<line\b/g) ?? []).length).toBe(5);
  });

  it("gebruikt geen utility rotate-klassen (bulletproof t.o.v. flex-col parents)", () => {
    const html = buildGentrixMenuIconToggle("navOpen");
    expect(html).not.toContain("rotate-45");
    expect(html).not.toContain("-rotate-45");
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
    expect(out).toContain("<svg");
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

  it("laat een knop met onze eigen gentrix-menu-icon toggle ongewijzigd", () => {
    const html = `<header x-data="{ navOpen: false }"><button type="button" class="lg:hidden gentrix-menu-repaired" aria-label="Menu" @click="navOpen = !navOpen"><span class="gentrix-menu-icon"><svg x-show="!navOpen"></svg><svg x-show="navOpen" x-cloak></svg></span></button></header>`;
    expect(repairHeaderMobileMenuButton(html)).toBe(html);
  });

  it("vervangt AI-output met losse x-show spans in een flex-col parent (MOSHAM-case)", () => {
    // Dit is precies de broken AI-output die in mosham.html staat:
    // 3 bars voor !navOpen + 2 gedraaide bars voor navOpen, binnen een flex flex-col gap-[5px] button.
    // De twee "X"-spans krijgen door de flex-col geen gedeeld centrum → "| |" i.p.v. een kruis.
    const html = `<header class="sticky top-0 z-50 bg-[#f5e6cb]" x-data="{ navOpen: false }">
  <button type="button" class="md:hidden flex flex-col gap-[5px] p-2" aria-label="Menu" @click="navOpen = !navOpen">
    <span x-show="!navOpen" class="block w-6 h-0.5 bg-[#1c130d]"></span>
    <span x-show="!navOpen" class="block w-6 h-0.5 bg-[#1c130d]"></span>
    <span x-show="!navOpen" class="block w-6 h-0.5 bg-[#1c130d]"></span>
    <span x-show="navOpen" class="block w-6 h-0.5 bg-[#1c130d] rotate-45 translate-y-[7px]"></span>
    <span x-show="navOpen" class="block w-6 h-0.5 bg-[#1c130d] -rotate-45"></span>
  </button>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toContain("gentrix-menu-icon");
    expect(out).toContain("<svg");
    // Oorspronkelijke kapotte spans met bg-[#1c130d] zijn weg
    expect(out).not.toContain("bg-[#1c130d]");
    expect(out).not.toContain("translate-y-[7px]");
    // Er is nog steeds een @click toggle
    expect(out).toContain("navOpen = !navOpen");
    // Crème header (`bg-[#f5e6cb]`, luminantie ≈ 233) is géén donker → kruis moet zwart zijn.
    expect(out).toMatch(/<button\b[^>]*\bclass="[^"]*\btext-neutral-900\b[^"]*"[^>]*>/);
  });

  it("kiest lichte tekstkleur op een donkere arbitrary hex header", () => {
    // Luminance van #08081a ≈ 11 (ITU-R BT.601) → duidelijk donker.
    const html = `<header x-data="{ navOpen: false }" class="bg-[#08081a]">
  <button type="button" class="lg:hidden w-10 h-10" aria-label="Menu"></button>
  <div class="lg:hidden" x-show="navOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toMatch(/<button\b[^>]*\bclass="[^"]*\btext-neutral-100\b[^"]*"[^>]*>/);
  });

  it("kiest donkere tekstkleur op een crème arbitrary hex header (MOSHAM)", () => {
    const html = `<header x-data="{ navOpen: false }" class="bg-[#f5e6cb]">
  <button type="button" class="lg:hidden w-10 h-10" aria-label="Menu"></button>
  <div class="lg:hidden" x-show="navOpen" x-cloak><a href="#a">A</a></div>
</header>`;
    const out = repairHeaderMobileMenuButton(html);
    expect(out).toMatch(/<button\b[^>]*\bclass="[^"]*\btext-neutral-900\b[^"]*"[^>]*>/);
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

describe("convertMobileDrawerToPushDown", () => {
  const MOSHAM_HEADER = `<header class="sticky top-0 z-50 bg-[#f5e6cb] w-full" x-data="{ navOpen: false }">
  <div class="flex items-center justify-between px-6 py-5 border-b border-[#1c130d]">
    <a href="#top">MoSham</a>
    <button type="button" class="md:hidden flex flex-col gap-[5px] p-2" aria-label="Menu" @click="navOpen = !navOpen"></button>
  </div>
  <div x-show="navOpen" class="fixed inset-0 bg-[#f5e6cb] z-[70] flex flex-col pt-20 px-8 gap-6 md:hidden lg:hidden">
    <a href="#a">Home</a>
    <a href="#b">Contact</a>
  </div>
</header>`;

  it("zet een full-screen `fixed inset-0` drawer in de header om naar push-down", () => {
    const out = convertMobileDrawerToPushDown(MOSHAM_HEADER);
    expect(out).toContain("gentrix-push-drawer");
    // Overlay-klassen moeten weg zijn
    expect(out).not.toMatch(/\bfixed\b/);
    expect(out).not.toContain("inset-0");
    expect(out).not.toContain("z-[70]");
    expect(out).not.toContain("pt-20");
    // Maar layout/kleur moet behouden blijven
    expect(out).toContain("bg-[#f5e6cb]");
    expect(out).toContain("flex flex-col");
    expect(out).toContain("gap-6");
    // Mobile-only gate blijft
    expect(out).toContain("lg:hidden");
    // Slide-down animatie via x-transition op max-height
    expect(out).toContain("transition-[max-height,opacity]");
    expect(out).toContain("max-h-0");
    expect(out).toContain("max-h-[80vh]");
    // x-cloak voorkomt flicker voor Alpine-init
    expect(out).toContain("x-cloak");
    // Links blijven intact
    expect(out).toContain(`<a href="#a">Home</a>`);
  });

  it("is idempotent: tweede run verandert niets meer", () => {
    const first = convertMobileDrawerToPushDown(MOSHAM_HEADER);
    const second = convertMobileDrawerToPushDown(first);
    expect(second).toBe(first);
  });

  it("laat een drawer die al in-flow is (geen fixed overlay) met rust", () => {
    const html = `<header x-data="{ navOpen: false }" class="sticky top-0 bg-white">
  <div class="flex justify-between py-4"><a href="#top">Logo</a><button aria-label="Menu">X</button></div>
  <div x-show="navOpen" class="lg:hidden bg-white px-4 py-3"><a href="#a">A</a></div>
</header>`;
    expect(convertMobileDrawerToPushDown(html)).toBe(html);
  });

  it("werkt ook voor drawers met menuOpen als state-key", () => {
    const html = `<header x-data="{ menuOpen: false }" class="sticky top-0 bg-white">
  <div class="flex justify-between py-4"><a>L</a><button>M</button></div>
  <div x-show="menuOpen" class="fixed inset-0 bg-white z-50 pt-20 md:hidden"><a href="#a">A</a></div>
</header>`;
    const out = convertMobileDrawerToPushDown(html);
    expect(out).toContain("gentrix-push-drawer");
    expect(out).not.toContain("fixed");
    expect(out).toContain(`x-show="menuOpen"`);
  });

  it("voegt een default verticale padding toe als die na stripping ontbreekt", () => {
    // Oorspronkelijke drawer gebruikt alleen `pt-20` voor afstand onder de fixed top-bar.
    // Na stripping moet er *iets* van vertical padding terugkomen.
    const html = `<header x-data="{ navOpen: false }">
  <div class="flex"><button>M</button></div>
  <div x-show="navOpen" class="fixed inset-0 bg-white z-50 pt-20 px-6 md:hidden"><a href="#a">A</a></div>
</header>`;
    const out = convertMobileDrawerToPushDown(html);
    expect(out).toMatch(/\bpy-\d/);
  });
});
