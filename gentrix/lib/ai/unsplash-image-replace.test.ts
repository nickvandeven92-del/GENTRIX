import { describe, expect, it } from "vitest";
import { composeUnsplashSearchQuery } from "@/lib/ai/unsplash-image-replace";

describe("composeUnsplashSearchQuery", () => {
  const theme =
    "Een webshop in erotische artikelen. Donker met neon rood, wallen Amsterdam sfeer. Rob Schoones.";

  it("zet briefing-keywords vóór generieke hero-alt (branche-eerst)", () => {
    const q = composeUnsplashSearchQuery({
      altText: "professional business team office",
      sectionId: "hero",
      sectionName: "Hero",
      sectionIndex: 0,
      themeContext: theme,
    });
    const lower = q.toLowerCase();
    expect(lower.startsWith("webshop") || lower.startsWith("erotische") || lower.startsWith("neon")).toBe(
      true,
    );
    expect(lower.includes("office")).toBe(true);
  });

  it("houdt bij niet-hero sectie sectie-alt vóór lange briefing (lokale context)", () => {
    const q = composeUnsplashSearchQuery({
      altText: "barber chair and mirror warm lighting",
      sectionId: "about",
      sectionName: "Over ons",
      sectionIndex: 2,
      themeContext: theme + " barbershop rotterdam",
    });
    expect(q.toLowerCase().startsWith("barber")).toBe(true);
  });

  it("valt terug op alt zonder themeContext", () => {
    const q = composeUnsplashSearchQuery({
      altText: "coffee roastery interior beans",
      sectionId: "hero",
      sectionName: "Hero",
      sectionIndex: 0,
      themeContext: "",
    });
    expect(q.toLowerCase()).toContain("coffee");
  });
});
