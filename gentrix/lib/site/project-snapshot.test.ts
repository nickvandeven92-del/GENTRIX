import { describe, expect, it } from "vitest";
import { siteAiSnapshotPatchSchema } from "@/lib/ai/site-ai-command-patch-schema";
import { mergeProjectSnapshotPatch } from "@/lib/site/merge-project-snapshot-patch";
import { projectSnapshotToCanonicalJsonString, toCanonicalProjectSnapshotObject } from "@/lib/site/project-snapshot-canonical";
import { parseAnyStoredProjectDataToLatestSnapshot } from "@/lib/site/project-snapshot-migrate";
import {
  PROJECT_SNAPSHOT_FORMAT,
  projectSnapshotToTailwindSectionsPayload,
  safeParseProjectSnapshot,
  tailwindSectionsPayloadToProjectSnapshot,
} from "@/lib/site/project-snapshot-schema";
import { SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE } from "@/lib/site/site-blueprint-registry";

const now = "2026-04-04T12:00:00.000Z";

function minimalV1(overrides?: Record<string, unknown>) {
  const base = {
    format: PROJECT_SNAPSHOT_FORMAT,
    meta: {
      schemaVersion: 1 as const,
      documentTitle: "Test",
      createdByKind: "import" as const,
      createdAt: now,
      lastModifiedAt: now,
    },
    siteConfig: {},
    composition: {
      sectionIdsOrdered: ["hero"],
      layoutPresetId: "default" as const,
    },
    sections: [{ id: "hero", sectionName: "Hero", html: "<section></section>" }],
    theme: { tokenOverrides: {} },
    assets: {},
    editor: {},
    generation: { source: "import" as const },
  };
  return { ...base, ...overrides };
}

describe("project_snapshot_v1", () => {
  it("parse: geldige v1 snapshot", () => {
    const r = safeParseProjectSnapshot(minimalV1());
    expect(r.ok).toBe(true);
  });

  it("parse: onbekende top-level key wordt geweigerd (.strict)", () => {
    const r = safeParseProjectSnapshot({ ...minimalV1(), layoutPreset: "oops" });
    expect(r.ok).toBe(false);
  });

  it("parseAny: duplicate section ids → invariant fail", () => {
    const snap = minimalV1({
      composition: { sectionIdsOrdered: ["a", "a"], layoutPresetId: "default" },
      sections: [
        { id: "a", sectionName: "One", html: "<section>1</section>" },
        { id: "a", sectionName: "Two", html: "<section>2</section>" },
      ],
    });
    const r = parseAnyStoredProjectDataToLatestSnapshot(snap, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/uniek|unique|sectionIdsOrdered/i);
  });

  it("parseAny: loose v1 zonder volledige meta wordt geüpgraded", () => {
    const loose = {
      format: PROJECT_SNAPSHOT_FORMAT,
      meta: { schemaVersion: 1, documentTitle: "X" },
      siteConfig: {},
      composition: { sectionIdsOrdered: ["x"] },
      sections: [{ id: "x", sectionName: "A", html: "<p>x</p>" }],
      theme: { tokenOverrides: {} },
      assets: {},
      editor: {},
      generation: { source: "editor" },
    };
    const strict = safeParseProjectSnapshot(loose);
    expect(strict.ok).toBe(false);

    const r = parseAnyStoredProjectDataToLatestSnapshot(loose, { nowIso: now });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshot.meta.createdByKind).toBe("editor");
      expect(r.snapshot.meta.createdAt).toBe(now);
      expect(r.snapshot.siteIr?.schemaVersion).toBe(1);
    }
  });

  it("parseAny: tailwind_sections payload → snapshot", () => {
    const tw = {
      format: "tailwind_sections" as const,
      sections: [{ sectionName: "Intro", html: "<section>i</section>" }],
    };
    const r = parseAnyStoredProjectDataToLatestSnapshot(tw, { nowIso: now });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.snapshot.siteIr?.blueprintId).toBe(SITE_BLUEPRINT_STUDIO_MARKETING_SINGLE_PAGE);
    }
  });

  it("canonical: twee keer hetzelfde JSON", () => {
    const snap = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [{ sectionName: "A", html: "<section>a</section>" }],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const a = projectSnapshotToCanonicalJsonString(snap);
    const b = projectSnapshotToCanonicalJsonString(snap);
    expect(a).toBe(b);
    const o1 = toCanonicalProjectSnapshotObject(snap);
    const o2 = toCanonicalProjectSnapshotObject(snap);
    expect(JSON.stringify(o1)).toBe(JSON.stringify(o2));
  });

  it("json roundtrip: snapshot → projectSnapshotToCanonicalJsonString → JSON.parse → parseAny → dezelfde canonieke string", () => {
    const snap = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [
          { sectionName: "Alpha", html: "<section>a</section>" },
          { id: "beta", sectionName: "Beta", html: "<section>b</section>", semanticRole: "cta" as const },
        ],
      },
      { generationSource: "import", createdByKind: "import", documentTitle: "Roundtrip" },
    );
    const json = projectSnapshotToCanonicalJsonString(snap);
    const fromWire = JSON.parse(json) as unknown;
    const r = parseAnyStoredProjectDataToLatestSnapshot(fromWire, {});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const jsonAgain = projectSnapshotToCanonicalJsonString(r.snapshot);
    expect(jsonAgain).toBe(json);
  });

  it("merge AI-patch behoudt section id", () => {
    const base = tailwindSectionsPayloadToProjectSnapshot(
      {
        format: "tailwind_sections",
        sections: [
          { id: "keep-me", sectionName: "A", html: "<section>old</section>" },
        ],
      },
      { generationSource: "import", createdByKind: "import" },
    );
    const merged = mergeProjectSnapshotPatch(base, {
      sectionUpdates: [{ sectionId: "keep-me", html: "<section>new</section>" }],
    });
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.snapshot.sections[0].id).toBe("keep-me");
      expect(merged.report.updatedSectionIds).toContain("keep-me");
    }
  });

  it("AI patch: ongeldige tokenOverride-key wordt geweigerd", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      theme: { tokenOverrides: { "not-a-real-key": "red" } },
    });
    expect(r.success).toBe(false);
  });

  it("AI patch: onbekende key op theme-blok wordt geweigerd", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      theme: { tokenOverrides: { "color.primary": "ok" }, extraTheme: true },
    });
    expect(r.success).toBe(false);
  });

  it("roundtrip: tailwind (met junk root) → snapshot → tailwind zonder junk", () => {
    const twIn = {
      format: "tailwind_sections" as const,
      sections: [{ sectionName: "X", html: "<section>x</section>" }],
      layoutPresetId: "should-strip",
    };
    const r = parseAnyStoredProjectDataToLatestSnapshot(twIn, { nowIso: now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const twOut = projectSnapshotToTailwindSectionsPayload(r.snapshot);
    expect("layoutPresetId" in twOut).toBe(false);
    expect(twOut.sections[0]).toMatchObject({ sectionName: "X" });
  });

  it("AI patch sectionUpdate: lege html-string wordt door schema geweigerd", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionId: "a", html: "" }],
    });
    expect(r.success).toBe(false);
  });

  it("AI patch: extra key op patch-root wordt geweigerd (.strict)", () => {
    const r = siteAiSnapshotPatchSchema.safeParse({
      sectionUpdates: [{ sectionId: "a", sectionName: "N" }],
      surprise: true,
    });
    expect(r.success).toBe(false);
  });
});
