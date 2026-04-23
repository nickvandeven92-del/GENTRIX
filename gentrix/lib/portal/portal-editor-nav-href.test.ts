import { describe, expect, it } from "vitest";
import { primarySitePathSegment, resolveNavHrefToPageId, type PortalEditorNavPage } from "./portal-editor-nav-href";

const samplePages: PortalEditorNavPage[] = [
  { id: "main", label: "Home" },
  { id: "marketing:wat-wij-doen", label: "Diensten" },
  { id: "marketing:over-ons", label: "Over ons" },
  { id: "marketing:faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

describe("primarySitePathSegment", () => {
  it("pakt het segment na /site/{slug}/", () => {
    expect(primarySitePathSegment("/site/mosham/wat-wij-doen")).toBe("wat-wij-doen");
    expect(primarySitePathSegment("/site/mosham%20x/contact")).toBe("contact");
  });

  it("geeft null voor alleen /site/slug (home-pad)", () => {
    expect(primarySitePathSegment("/site/mosham")).toBeNull();
    expect(primarySitePathSegment("/site/mosham/")).toBeNull();
  });

  it("ondersteunt korte paden zonder /site-prefix", () => {
    expect(primarySitePathSegment("/faq")).toBe("faq");
    expect(primarySitePathSegment("/diensten")).toBe("diensten");
  });
});

describe("resolveNavHrefToPageId", () => {
  it("resolved volledige site-URL naar marketingpagina", () => {
    expect(resolveNavHrefToPageId("https://www.gentrix.nl/site/mosham/wat-wij-doen", samplePages)).toBe(
      "marketing:wat-wij-doen",
    );
  });

  it("resolved relatief /site/… pad", () => {
    expect(resolveNavHrefToPageId("/site/mosham/over-ons", samplePages)).toBe("marketing:over-ons");
  });

  it("synoniem diensten → wat-wij-doen", () => {
    expect(resolveNavHrefToPageId("/site/mosham/diensten", samplePages)).toBe("marketing:wat-wij-doen");
  });

  it("hash-link", () => {
    expect(resolveNavHrefToPageId("#faq", samplePages)).toBe("marketing:faq");
  });
});
