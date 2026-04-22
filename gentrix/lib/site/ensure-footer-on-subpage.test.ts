import { describe, expect, it } from "vitest";
import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import {
  ensureFooterAppendedFromLanding,
  findLandingFooterSection,
} from "@/lib/site/ensure-footer-on-subpage";

function section(partial: Partial<TailwindSection> & { html: string }): TailwindSection {
  return {
    id: partial.id,
    sectionName: partial.sectionName ?? partial.id ?? "section",
    html: partial.html,
    semanticRole: partial.semanticRole,
  };
}

const heroSection = section({ id: "hero", semanticRole: "hero", html: "<section><h1>Hero</h1></section>" });
const featuresSection = section({ id: "features", html: "<section>features</section>" });
const footerBySemanticRole = section({
  id: "site-footer",
  semanticRole: "footer",
  html: "<footer>© Studio</footer>",
});
const footerById = section({ id: "footer", html: "<footer>© Studio</footer>" });

describe("findLandingFooterSection", () => {
  it("vindt footer via semanticRole", () => {
    expect(findLandingFooterSection([heroSection, footerBySemanticRole])).toBe(footerBySemanticRole);
  });

  it("vindt footer via id", () => {
    expect(findLandingFooterSection([heroSection, footerById])).toBe(footerById);
  });

  it("vindt footer via <footer>-tag in html als id/rol ontbreekt", () => {
    const fallback = section({ id: "outro", html: "<section><footer>© 2026</footer></section>" });
    expect(findLandingFooterSection([heroSection, fallback])).toBe(fallback);
  });

  it("null als geen footer aanwezig is", () => {
    expect(findLandingFooterSection([heroSection, featuresSection])).toBeNull();
  });

  it("null bij lege/ontbrekende lijst", () => {
    expect(findLandingFooterSection([])).toBeNull();
    expect(findLandingFooterSection(null)).toBeNull();
    expect(findLandingFooterSection(undefined)).toBeNull();
  });
});

describe("ensureFooterAppendedFromLanding", () => {
  it("voegt landings-footer toe aan subpagina zonder footer", () => {
    const subpage = [section({ id: "contact", html: "<section>contact form</section>" })];
    const out = ensureFooterAppendedFromLanding(subpage, [heroSection, footerBySemanticRole]);
    expect(out).toHaveLength(2);
    expect(out[1]).toBe(footerBySemanticRole);
  });

  it("laat subpagina ongewijzigd als er al een footer-sectie staat", () => {
    const subpageFooter = section({ id: "footer", html: "<footer>eigen</footer>" });
    const subpage = [section({ id: "contact", html: "<section>contact</section>" }), subpageFooter];
    const out = ensureFooterAppendedFromLanding(subpage, [heroSection, footerBySemanticRole]);
    expect(out).toEqual(subpage);
  });

  it("laat subpagina ongewijzigd als landing geen footer heeft", () => {
    const subpage = [section({ id: "contact", html: "<section>contact</section>" })];
    const out = ensureFooterAppendedFromLanding(subpage, [heroSection, featuresSection]);
    expect(out).toEqual(subpage);
  });
});
