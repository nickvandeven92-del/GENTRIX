import { describe, expect, it } from "vitest";
import { coerceHeaderWhatsappLinksToBookingPlaceholder } from "@/lib/site/coerce-appointment-header-hrefs";
import { STUDIO_BOOKING_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

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
