import { describe, expect, it } from "vitest";
import { PROJECT_SNAPSHOT_FORMAT } from "@/lib/site/project-snapshot-schema";
import { parseStoredSiteData } from "@/lib/site/parse-stored-site-data";

describe("parseStoredSiteData", () => {
  it("legacy generatedSite → kind legacy", () => {
    const legacy = {
      meta: { title: "Mijn site" },
      theme: {
        primary: "#111111",
        background: "#ffffff",
        foreground: "#000000",
      },
      sections: [{ id: "hero-1", type: "hero" as const, headline: "Welkom" }],
    };
    const p = parseStoredSiteData(legacy);
    expect(p).not.toBeNull();
    expect(p?.kind).toBe("legacy");
    if (p?.kind === "legacy") {
      expect(p.site.meta.title).toBe("Mijn site");
      expect(p.site.sections[0]).toMatchObject({ type: "hero", headline: "Welkom" });
    }
  });

  it("react_sections → kind react", () => {
    const p = parseStoredSiteData({
      format: "react_sections",
      schemaVersion: 1,
      documentTitle: "Salon X",
      theme: {
        primary: "#18181b",
        accent: "#c4a962",
        background: "#ffffff",
        foreground: "#0a0a0a",
      },
      sections: [
        {
          id: "hero-1",
          type: "hero_cinematic",
          props: { headline: "Welkom" },
        },
      ],
    });
    expect(p?.kind).toBe("react");
    if (p?.kind === "react") {
      expect(p.doc.documentTitle).toBe("Salon X");
      expect(p.doc.sections[0]).toMatchObject({ type: "hero_cinematic", props: { headline: "Welkom" } });
    }
  });

  it("tailwind_sections met meegeliftede keys → nog steeds kind tailwind", () => {
    const p = parseStoredSiteData({
      format: "tailwind_sections",
      sections: [{ sectionName: "Home", html: "<section>h</section>" }],
      runId: "deadbeef",
    });
    expect(p?.kind).toBe("tailwind");
    if (p?.kind === "tailwind") {
      expect(p.sections[0].sectionName).toBe("Home");
    }
  });

  it("losse secties-array (zonder format) → tailwind via wrap", () => {
    const p = parseStoredSiteData({
      sections: [{ sectionName: "Only", html: "<section>o</section>" }],
    });
    expect(p?.kind).toBe("tailwind");
  });

  it("corrupt / onbekend JSON → null", () => {
    expect(parseStoredSiteData({ foo: 1, bar: [] })).toBeNull();
    expect(parseStoredSiteData(null)).toBeNull();
  });

  it("project_snapshot_v1 dat niet te migreren valideert → null (geen stille fallback)", () => {
    const corrupt = {
      format: PROJECT_SNAPSHOT_FORMAT,
      meta: { schemaVersion: 1 },
      // geen geldige sections / composition
    };
    expect(parseStoredSiteData(corrupt)).toBeNull();
  });
});
