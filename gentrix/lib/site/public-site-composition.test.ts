import { describe, expect, it } from "vitest";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import { ensureStudioModuleMarkersOnAnchors } from "@/lib/site/ensure-studio-module-markers-on-anchors";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import { buildSiteIrV1 } from "@/lib/site/site-ir-schema";
import { inactivePublicSiteModuleIds } from "@/lib/site/public-site-modules-registry";
import { stripInactivePublicModuleMarkupFromHtml } from "@/lib/site/strip-public-module-markup";
import { STUDIO_BOOKING_PATH_PLACEHOLDER, STUDIO_SHOP_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

describe("ensureStudioModuleMarkersOnAnchors", () => {
  it("voegt data-studio-module toe op legacy booking-placeholder", () => {
    const html = `<nav><a href="${STUDIO_BOOKING_PATH_PLACEHOLDER}">Boek</a></nav>`;
    const out = ensureStudioModuleMarkersOnAnchors(html);
    expect(out).toContain('data-studio-module="appointments"');
    expect(out).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("voegt data-studio-module toe voor webshop-placeholder", () => {
    const html = `<a href="${STUDIO_SHOP_PATH_PLACEHOLDER}">Shop</a>`;
    const out = ensureStudioModuleMarkersOnAnchors(html);
    expect(out).toContain('data-studio-module="webshop"');
  });

  it("past bestaande module-markering niet dubbel aan", () => {
    const html = `<a data-studio-module="appointments" href="${STUDIO_BOOKING_PATH_PLACEHOLDER}">X</a>`;
    expect(ensureStudioModuleMarkersOnAnchors(html).match(/data-studio-module=/g)?.length).toBe(1);
  });
});

describe("stripInactivePublicModuleMarkupFromHtml", () => {
  it("verwijdert module-ankers wanneer appointments uit staat", () => {
    const html = `<ul><li><a data-studio-module="appointments" href="#">Boek</a></li></ul>`;
    const out = stripInactivePublicModuleMarkupFromHtml(
      html,
      inactivePublicSiteModuleIds({ appointmentsEnabled: false, webshopEnabled: true }),
    );
    expect(out).not.toContain("Boek");
    expect(out).not.toContain("data-studio-module");
  });

  it("verwijdert feature-zone voor inactieve module", () => {
    const html = `<main><div data-studio-feature-zone="appointments" class="x"><p>Alleen boeken</p></div><p>Rest</p></main>`;
    const out = stripInactivePublicModuleMarkupFromHtml(
      html,
      inactivePublicSiteModuleIds({ appointmentsEnabled: false, webshopEnabled: true }),
    );
    expect(out).not.toContain("Alleen boeken");
    expect(out).toContain("Rest");
  });
});

describe("composePublicMarketingTailwindSections", () => {
  it("filtert booking-sectie en strippt gemarkeerde nav", () => {
    const sections: TailwindSection[] = [
      {
        id: "header",
        sectionName: "Header",
        html: `<header><a href="${STUDIO_BOOKING_PATH_PLACEHOLDER}">Plan</a></header>`,
      },
      { id: "booking", sectionName: "Boeken", html: `<div id="booking">x</div>` },
    ];
    const out = composePublicMarketingTailwindSections(sections, {
      appointmentsEnabled: false,
      webshopEnabled: false,
    });
    expect(out.some((s) => s.id === "booking")).toBe(false);
    expect(out[0]?.html.includes("Plan")).toBe(false);
    expect(out[0]?.html.includes(STUDIO_BOOKING_PATH_PLACEHOLDER)).toBe(false);
  });

  it("met appointments AAN: tailwind-sectie id hero coerced volledige HTML (geen inner id=hero nodig)", () => {
    const sections: TailwindSection[] = [
      {
        id: "hero",
        sectionName: "Hero",
        html: `<section class="min-h-screen"><a href="#contact" class="btn">MAAK EEN AFSPRAAK</a></section>`,
      },
    ];
    const out = composePublicMarketingTailwindSections(sections, {
      appointmentsEnabled: true,
      webshopEnabled: false,
    });
    expect(out[0]?.html).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("met appointments AAN: #contact + reserveer-tekst in header wordt booking-placeholder", () => {
    const sections: TailwindSection[] = [
      {
        id: "header",
        sectionName: "Header",
        html: `<header><a href="#contact" class="btn">Reserveer</a></header>`,
      },
    ];
    const out = composePublicMarketingTailwindSections(sections, {
      appointmentsEnabled: true,
      webshopEnabled: false,
    });
    expect(out[0]?.html).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("prefereert siteIr.sectionIdsOrdered boven plan.sectionIdsOrdered", () => {
    const sections: TailwindSection[] = [
      { id: "a", sectionName: "A", html: "<section>a</section>" },
      { id: "b", sectionName: "B", html: "<section>b</section>" },
    ];
    const siteIr = buildSiteIrV1({ sectionIdsOrdered: ["b", "a"] });
    const out = composePublicMarketingTailwindSections(
      sections,
      { appointmentsEnabled: false, webshopEnabled: false },
      { sectionIdsOrdered: ["a", "b"], siteIr },
    );
    expect(out.map((s) => s.id)).toEqual(["b", "a"]);
  });
});
