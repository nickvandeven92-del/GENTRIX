import { describe, expect, it } from "vitest";
import { tailwindSectionsPayloadSchema } from "@/lib/ai/tailwind-sections-schema";
import { ensureTailwindCompiledCssOnPublishedPayload } from "@/lib/data/tailwind-compiled-css-attach";
import { tailwindSectionsPayloadFromPublishedTailwind } from "@/lib/data/tailwind-sections-payload-from-published";
import type { PublishedSitePayload } from "@/lib/site/project-published-payload";

const minimalTailwindPublished = (overrides?: Partial<Extract<PublishedSitePayload, { kind: "tailwind" }>>) =>
  ({
    kind: "tailwind" as const,
    clientName: "Test BV",
    generationPackage: "studio",
    sections: [
      {
        id: "hero",
        sectionName: "Hero",
        html: '<section class="w-full bg-slate-100 py-12"><p class="text-xl font-bold">Hallo</p></section>',
      },
    ],
    ...overrides,
  }) satisfies Extract<PublishedSitePayload, { kind: "tailwind" }>;

describe("tailwindSectionsPayloadFromPublishedTailwind", () => {
  it("produces a schema-valid tailwind_sections payload", () => {
    const published = minimalTailwindPublished({
      customCss: " .x{color:red}",
      contactSections: [{ id: "c", sectionName: "Contact", html: "<section></section>" }],
      marketingPages: { diensten: [{ id: "m", sectionName: "D", html: "<section></section>" }] },
    });
    const tw = tailwindSectionsPayloadFromPublishedTailwind(published);
    const parsed = tailwindSectionsPayloadSchema.safeParse(tw);
    expect(parsed.success).toBe(true);
  });
});

describe("ensureTailwindCompiledCssOnPublishedPayload", () => {
  it("returns non-tailwind payloads unchanged", async () => {
    const legacy = {
      kind: "legacy" as const,
      clientName: "X",
      generationPackage: "studio" as const,
      site: {
        meta: { title: "T", description: "D" },
        theme: {
          primary: "#000000",
          background: "#ffffff",
          foreground: "#111111",
        },
        sections: [
          {
            id: "hero",
            type: "hero" as const,
            headline: "Hallo",
          },
        ],
      },
    };
    const out = await ensureTailwindCompiledCssOnPublishedPayload(legacy, "T");
    expect(out).toBe(legacy);
  });

  it("short-circuits when tailwindCompiledCss is already set", async () => {
    const published = minimalTailwindPublished({
      tailwindCompiledCss: ".foo{color:blue}",
    });
    const out = await ensureTailwindCompiledCssOnPublishedPayload(published, "T");
    expect(out).toBe(published);
  });
});
