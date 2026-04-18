import { describe, expect, it } from "vitest";
import { getGenerationPackagePromptBlock } from "@/lib/ai/generation-packages";
import { buildWebsiteGenerationUserPrompt } from "@/lib/ai/generate-site-with-claude";

/** Oude §0B-marketingzin (absoluut “geen extra secties buiten de lijst”) — mag nergens meer terugkomen. */
const LEGACY_ABSOLUTE_EXTRA_SECTIONS = /voeg geen[\s*]*extra secties toe buiten die lijst/i;

describe("getGenerationPackagePromptBlock — structuur vrije generatie vs upgrade", () => {
  it("vrije generatie: exhaustieve lijst, geen willekeurige extra marketingsecties", () => {
    const body = getGenerationPackagePromptBlock();
    expect(body).toContain("**Structuur (vrije generatie):**");
    expect(body).toContain("exhaustief");
    expect(body).toContain("extra marketingsecties");
    expect(body).toContain("nieuwe marketingsectie-");
    expect(body).not.toMatch(LEGACY_ABSOLUTE_EXTRA_SECTIONS);
  });

  it("vrije generatie: geen upgrade-specifieke ‘Gemergde lijst = enige waarheid’", () => {
    const body = getGenerationPackagePromptBlock();
    expect(body).not.toContain("Gemergde lijst = enige waarheid");
  });

  it("upgrade: geen legacy-verbod; wél gemergde lijst, bron eerst, briefing aan gemergde lijst", () => {
    const body = getGenerationPackagePromptBlock(undefined, { preserveLayoutUpgrade: true });
    expect(body).not.toMatch(LEGACY_ABSOLUTE_EXTRA_SECTIONS);
    expect(body).toContain("Gemergde lijst = enige waarheid");
    expect(body).toContain("**Bron eerst:**");
    expect(body).toContain("in de gemergde");
    expect(body).toContain("sectielijst");
  });

  it("upgrade: nieuwe marketingsecties alleen expliciet + id in gemergde lijst", () => {
    const body = getGenerationPackagePromptBlock(undefined, { preserveLayoutUpgrade: true });
    expect(body).toContain("**expliciet** vraagt");
    expect(body).toContain("in de gemergde");
  });
});

describe("buildWebsiteGenerationUserPrompt — §0B ingebed", () => {
  it("upgrade-prompt bevat upgrade-structuur, niet het oude absolute verbod", () => {
    const full = buildWebsiteGenerationUserPrompt("Test BV", "Voeg pricing toe.", [], {
      preserveLayoutUpgrade: true,
      existingSiteTailwindJson: '{"config":null,"sections":[{"id":"hero","html":"<section></section>"}]}',
    });
    expect(full).toContain("Gemergde lijst = enige waarheid");
    expect(full).not.toMatch(LEGACY_ABSOLUTE_EXTRA_SECTIONS);
  });

  it("vrije-generatie-prompt bevat exhaustieve sectieregels", () => {
    const full = buildWebsiteGenerationUserPrompt("Test BV", "Nieuwe site.", [], undefined);
    expect(full).toContain("exhaustief");
    expect(full).not.toMatch(LEGACY_ABSOLUTE_EXTRA_SECTIONS);
  });

  it("user-prompt bevat CONTENT AUTHORITY (anti-hallucinatie)", () => {
    const full = buildWebsiteGenerationUserPrompt("Test BV", "Kapper in Utrecht.", [], undefined);
    expect(full).toContain("CONTENT AUTHORITY");
    expect(full).toMatch(/Absence of data is not permission to invent/i);
    expect(full).toMatch(/Black Friday|black friday/i);
  });

  it("`minimalPrompt` wordt genegeerd: zelfde volledige prompt als zonder vlag", () => {
    const full = buildWebsiteGenerationUserPrompt("Test BV", "Kapper in Utrecht premium luxe modern.", [], undefined);
    const withFlag = buildWebsiteGenerationUserPrompt("Test BV", "Kapper in Utrecht premium luxe modern.", [], {
      minimalPrompt: true,
    });
    expect(withFlag).toContain("CONTENT AUTHORITY");
    expect(withFlag).toContain("BRANCHE-INSPIRATIE (gedetecteerd");
    expect(withFlag.length).toBe(full.length);
  });
});
