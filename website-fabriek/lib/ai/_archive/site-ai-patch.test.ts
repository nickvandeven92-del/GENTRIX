import { describe, expect, it } from "vitest";
import { assertAiCommandPreMergeContract } from "@/lib/ai/ai-command-post-sanity";
import { rejectForbiddenAiPatchShape } from "@/lib/ai/ai-patch-mutation-policy";
import { siteAiSnapshotPatchSchema } from "@/lib/ai/site-ai-command-patch-schema";
import { mergeProjectSnapshotPatch } from "@/lib/site/merge-project-snapshot-patch";
import { tailwindSectionsPayloadToProjectSnapshot } from "@/lib/site/project-snapshot-schema";

describe("fase 2.1 AI patch refusal & targeting", () => {
  it("pre-merge: sharpen_primary_cta zonder cta-sectie faalt", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [{ id: "a", sectionName: "A", html: "<section>x</section>", semanticRole: "hero" as const }],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const r = assertAiCommandPreMergeContract("sharpen_primary_cta", base);
    expect(r.ok).toBe(false);
  });

  it("pre-merge: sharpen_primary_cta met cta-sectie slaagt", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [
          { id: "h", sectionName: "H", html: "<section>h</section>", semanticRole: "hero" as const },
          { id: "c", sectionName: "C", html: "<section>c</section>", semanticRole: "cta" as const },
        ],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const r = assertAiCommandPreMergeContract("sharpen_primary_cta", base);
    expect(r.ok).toBe(true);
  });

  it("weigert ruwe patch met volledige sections-array", () => {
    const r = rejectForbiddenAiPatchShape({ sections: [], meta: {} });
    expect(r.ok).toBe(false);
  });

  it("weigert onbekende top-level patch-key vóór Zod", () => {
    const r = rejectForbiddenAiPatchShape({ generation: { source: "x" } });
    expect(r.ok).toBe(false);
  });

  it("sectionUpdates zonder sectionId: schema faalt", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionName: "x" }],
    });
    expect(r.success).toBe(false);
  });

  it("sectionUpdate met index-key: .strict weigert", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionId: "a", index: 0, html: "<p>x</p>" }],
    });
    expect(r.success).toBe(false);
  });

  it("copyIntent te kort: schema faalt", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionId: "a", copyIntent: "ab" }],
    });
    expect(r.success).toBe(false);
  });

  it("copyIntent lege string: schema faalt", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionId: "a", copyIntent: "   " }],
    });
    expect(r.success).toBe(false);
  });

  it("merge: sectionId leidend — tweede sectie", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [
          { id: "first", sectionName: "A", html: "<section>a</section>" },
          { id: "second", sectionName: "B", html: "<section>b</section>" },
        ],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const merged = mergeProjectSnapshotPatch(base, {
      sectionUpdates: [{ sectionId: "second", html: "<section>bbb</section>" }],
    });
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.snapshot.sections[1].html).toContain("bbb");
      expect(merged.report.updatedSectionIds).toEqual(["second"]);
    }
  });

  it("merge: onbekende sectionId faalt", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [{ id: "a", sectionName: "A", html: "<section>a</section>" }],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const merged = mergeProjectSnapshotPatch(base, {
      sectionUpdates: [{ sectionId: "nope", html: "<section>x</section>" }],
    });
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toMatch(/onbekende sectionId/i);
  });

  it("merge: whitespace-only html faalt invariant", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [{ id: "x", sectionName: "A", html: "<section>ok</section>" }],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const merged = mergeProjectSnapshotPatch(base, {
      sectionUpdates: [{ sectionId: "x", html: "   \n  " }],
    });
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toMatch(/Invarianten|leeg|whitespace/i);
  });

  it("merge: dubbele hero semanticRole faalt invariant", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [
          { id: "h1", sectionName: "H1", html: "<section>1</section>", semanticRole: "hero" as const },
          { id: "h2", sectionName: "H2", html: "<section>2</section>" },
        ],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const merged = mergeProjectSnapshotPatch(base, {
      sectionUpdates: [{ sectionId: "h2", semanticRole: "hero" }],
    });
    expect(merged.ok).toBe(false);
    if (!merged.ok) expect(merged.error).toMatch(/hero|maximaal/i);
  });

  it("meer dan max sectionUpdates: schema faalt", () => {
    const updates = Array.from({ length: 13 }, (_, i) => ({
      sectionId: "a",
      sectionName: `N${i}`,
    }));
    const r = siteAiSnapshotPatchSchema.safeParse({ sectionUpdates: updates });
    expect(r.success).toBe(false);
  });

  it("assets.customJs in patch: schema heeft geen veld — alleen css/logo", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      assets: { customJs: "alert(1)" },
    });
    expect(r.success).toBe(false);
  });
});
