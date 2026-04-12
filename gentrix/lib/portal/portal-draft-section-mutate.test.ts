import { describe, expect, it } from "vitest";
import { applyPortalSectionPatches, listPortalDraftSectionRows } from "@/lib/portal/portal-draft-section-mutate";
import { tailwindSectionsPayloadSchema } from "@/lib/ai/tailwind-sections-schema";

const minimalPayload = tailwindSectionsPayloadSchema.parse({
  format: "tailwind_sections",
  sections: [
    { sectionName: "Hero", html: '<section><h1 class="text-2xl">A</h1></section>' },
    { sectionName: "Features", html: "<section><p>B</p></section>" },
  ],
});

describe("portal-draft-section-mutate", () => {
  it("lists main keys with indices", () => {
    const rows = listPortalDraftSectionRows(minimalPayload);
    expect(rows.map((r) => r.key)).toEqual(["main:0", "main:1"]);
  });

  it("applies patch by main index", () => {
    const out = applyPortalSectionPatches(
      minimalPayload,
      [{ key: "main:0", html: '<section><h1 class="text-2xl">Nieuw</h1></section>' }],
      { existingDocumentTitle: "Titel" },
    );
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.nextPayload.sections[0]?.html).toContain("Nieuw");
    expect(out.documentTitleOut).toBe("Titel");
  });
});
