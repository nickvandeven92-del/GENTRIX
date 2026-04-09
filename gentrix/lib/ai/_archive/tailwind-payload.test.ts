import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  stripUnknownTailwindPayloadKeys,
  tailwindSectionsPayloadSchema,
} from "@/lib/ai/tailwind-sections-schema";

describe("tailwind_sections payload", () => {
  it("stripUnknownTailwindPayloadKeys verwijdert onbekende root-keys", () => {
    const stripped = stripUnknownTailwindPayloadKeys({
      format: "tailwind_sections",
      sections: [{ sectionName: "A", html: "<section>a</section>" }],
      layoutPresetId: "legacy-alias",
      streamTimingsMs: [1, 2, 3],
    });
    expect(stripped).toEqual({
      format: "tailwind_sections",
      sections: [{ sectionName: "A", html: "<section>a</section>" }],
    });
  });

  it("tailwindSectionsPayloadSchema: extra root-keys worden gestript; .strict() output zonder meelifters", () => {
    const r = tailwindSectionsPayloadSchema.safeParse({
      format: "tailwind_sections",
      sections: [{ sectionName: "B", html: "<section>b</section>" }],
      extraRoot: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect("extraRoot" in r.data).toBe(false);
      expect(r.data.format).toBe("tailwind_sections");
    }
  });

  it("zelfde object faalt tegen strikt object zonder preprocess", () => {
    const strictInner = z
      .object({
        format: z.literal("tailwind_sections"),
        sections: z.array(z.unknown()),
      })
      .strict();
    const raw = {
      format: "tailwind_sections" as const,
      sections: [{ sectionName: "C", html: "<section>c</section>" }],
      telemetry: true,
    };
    expect(strictInner.safeParse(raw).success).toBe(false);
    expect(strictInner.safeParse(stripUnknownTailwindPayloadKeys(raw)).success).toBe(true);
  });

  it("non-tailwind input wordt niet gemuteerd door strip", () => {
    const legacy = { format: "legacy-ish", sections: [] };
    expect(stripUnknownTailwindPayloadKeys(legacy)).toBe(legacy);
  });
});
