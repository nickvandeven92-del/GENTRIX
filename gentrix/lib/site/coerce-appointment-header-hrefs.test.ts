import { describe, expect, it } from "vitest";
import {
  coerceContactBookCtaAnchorsInHtmlFragment,
  coerceHeaderAppointmentCtaHrefs,
  coerceHeaderContactBookCtasToBookingPlaceholder,
  coerceHeaderWhatsappLinksToBookingPlaceholder,
  coerceHeroContactBookCtasToBookingPlaceholder,
} from "@/lib/site/coerce-appointment-header-hrefs";
import {
  STUDIO_BOOKING_PATH_PLACEHOLDER,
  STUDIO_CONTACT_PATH_PLACEHOLDER,
  STUDIO_SITE_BASE_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";

describe("coerceHeaderWhatsappLinksToBookingPlaceholder", () => {
  it("vervangt WhatsApp-href op Maak afspraak in header", () => {
    const html = `<header><a href="https://wa.me/31612345678" class="btn">Maak afspraak</a></header>`;
    expect(coerceHeaderWhatsappLinksToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
    expect(coerceHeaderWhatsappLinksToBookingPlaceholder(html)).not.toContain("wa.me");
  });

  it("laat WhatsApp-knop in header met alleen WhatsApp-tekst met rust", () => {
    const html = `<header><a href="https://wa.me/31612345678">WhatsApp</a></header>`;
    const out = coerceHeaderWhatsappLinksToBookingPlaceholder(html);
    expect(out).toContain("wa.me");
  });

  it("raakt WhatsApp buiten header niet aan", () => {
    const html = `<section><a href="https://wa.me/x">Maak afspraak</a></section>`;
    expect(coerceHeaderWhatsappLinksToBookingPlaceholder(html)).toContain("wa.me");
  });
});

describe("coerceHeaderContactBookCtasToBookingPlaceholder", () => {
  it("zet #contact om naar booking bij reserveer-tekst in header", () => {
    const html = `<header><a href="#contact" class="btn">Reserveer</a></header>`;
    expect(coerceHeaderContactBookCtasToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
    expect(coerceHeaderContactBookCtasToBookingPlaceholder(html)).not.toContain('href="#contact"');
  });

  it("zet contact-placeholder om bij Maak een afspraak", () => {
    const html = `<header><a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}">Maak een afspraak</a></header>`;
    expect(coerceHeaderContactBookCtasToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("zet __STUDIO_SITE_BASE__/contact om bij boek-CTA", () => {
    const html = `<header><a href="${STUDIO_SITE_BASE_PLACEHOLDER}/contact">Boek online</a></header>`;
    expect(coerceHeaderContactBookCtasToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("laat echte Contact-link met rust", () => {
    const html = `<header><a href="#contact">Contact</a></header>`;
    expect(coerceHeaderContactBookCtasToBookingPlaceholder(html)).toContain('href="#contact"');
  });
});

describe("coerceHeroContactBookCtasToBookingPlaceholder", () => {
  it("past toe in sectie id=hero", () => {
    const html = `<section id="hero"><a href="#contact" class="cta">Boek online</a></section>`;
    expect(coerceHeroContactBookCtasToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("hero-id is hoofdletterongevoelig op de waarde", () => {
    const html = `<section id="Hero"><a href="#contact">Reserveer</a></section>`;
    expect(coerceHeroContactBookCtasToBookingPlaceholder(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });
});

describe("coerceContactBookCtaAnchorsInHtmlFragment", () => {
  it("past toe op willekeurige hero-HTML (geen inner section id)", () => {
    const html = `<section class="min-h-screen"><a href="#contact">MAAK EEN AFSPRAAK</a></section>`;
    expect(coerceContactBookCtaAnchorsInHtmlFragment(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });

  it("herkent al-opgeloste /site/{slug}/contact URL bij boeking-intent tekst", () => {
    const html = `<section id="hero"><a href="/site/mosham/contact" class="btn">Maak een afspraak</a></section>`;
    expect(coerceContactBookCtaAnchorsInHtmlFragment(html)).toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
    expect(coerceContactBookCtaAnchorsInHtmlFragment(html)).not.toContain("/site/mosham/contact");
  });

  it("laat opgeloste /contact URL met Contact-tekst ongemoeid", () => {
    const html = `<a href="/site/mosham/contact">Contact</a>`;
    expect(coerceContactBookCtaAnchorsInHtmlFragment(html)).toContain("/site/mosham/contact");
    expect(coerceContactBookCtaAnchorsInHtmlFragment(html)).not.toContain(STUDIO_BOOKING_PATH_PLACEHOLDER);
  });
});

describe("coerceHeaderAppointmentCtaHrefs", () => {
  it("ketent WhatsApp + contact in header en hero", () => {
    const html = `<header><a href="#contact">Reserveer</a></header><section id="hero"><a href="#contact">Boek nu</a></section>`;
    const out = coerceHeaderAppointmentCtaHrefs(html);
    expect(out.match(new RegExp(STUDIO_BOOKING_PATH_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length).toBe(
      2,
    );
  });
});
