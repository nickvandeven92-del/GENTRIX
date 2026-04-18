import { describe, expect, it } from "vitest";
import { slugifyClientNameForSubfolder } from "@/lib/studio/client-name-for-slug";

describe("slugifyClientNameForSubfolder", () => {
  it("kapt lange instructie na punt af en neemt alleen merk vóór 'kapper'", () => {
    expect(
      slugifyClientNameForSubfolder(
        "MoSham kapper in vught. Voeg de reviews toe op de landingspagina",
      ),
    ).toBe("mosham");
  });

  it("normale korte naam blijft ongewijzigd", () => {
    expect(slugifyClientNameForSubfolder("MoSham")).toBe("mosham");
    expect(slugifyClientNameForSubfolder("Rudenko's Fish")).toBe("rudenko-s-fish");
  });

  it("hergebruikt website-voor-naam uit briefing", () => {
    expect(
      slugifyClientNameForSubfolder(
        "Genereer een website voor MoSham met de volgende info:\n\nAdres: …",
      ),
    ).toBe("mosham");
  });
});
