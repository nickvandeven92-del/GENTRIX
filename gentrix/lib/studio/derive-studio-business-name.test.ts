import { describe, expect, it } from "vitest";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { STUDIO_UNDECIDED_BRAND_SENTINEL } from "@/lib/studio/studio-brand-sentinel";

describe("deriveStudioBusinessNameFromBriefing", () => {
  it("detecteert naam uit 'website voor … met'", () => {
    expect(
      deriveStudioBusinessNameFromBriefing(
        "Genereer een website voor MoSham met de volgende info:\n\nAdres: …",
      ),
    ).toBe("MoSham");
  });

  it("label Bedrijfsnaam wint vóór 'website voor'", () => {
    expect(
      deriveStudioBusinessNameFromBriefing(
        "website voor AndereZaak\n\nBedrijfsnaam: Vaste Naam BV",
      ),
    ).toBe("Vaste Naam BV");
  });

  it("English: website for … with", () => {
    expect(
      deriveStudioBusinessNameFromBriefing("Please build a website for Acme Labs with these details."),
    ).toBe("Acme Labs");
  });

  it("NL: website maken voor …", () => {
    expect(
      deriveStudioBusinessNameFromBriefing(
        "Maak een website maken voor MoSham met donkere stijl en veel foto's.",
      ),
    ).toBe("MoSham");
  });

  it("NL: voor \"…\" met aanhalingstekens", () => {
    expect(deriveStudioBusinessNameFromBriefing('Genereer een site voor "Vaste Naam" in Utrecht.')).toBe(
      "Vaste Naam",
    );
  });

  it("NL: het bedrijf heet …", () => {
    expect(deriveStudioBusinessNameFromBriefing("Kort: het bedrijf heet Café Noord. Stijl: warm.")).toBe(
      "Café Noord",
    );
  });

  it("NL: merknaam is …", () => {
    expect(deriveStudioBusinessNameFromBriefing("De merknaam is MoSham; ze willen een one-pager.")).toBe(
      "MoSham",
    );
  });

  it("alleen URL → hostname", () => {
    expect(deriveStudioBusinessNameFromBriefing("https://www.example.com/pad")).toBe("example.com");
  });

  it("geen signaal → sentinel", () => {
    expect(deriveStudioBusinessNameFromBriefing("Kapper in Vught, industriële stijl.")).toBe(
      STUDIO_UNDECIDED_BRAND_SENTINEL,
    );
  });
});
