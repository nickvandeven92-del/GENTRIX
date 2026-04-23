import { describe, expect, it } from "vitest";
import { PROJECT_SNAPSHOT_FORMAT } from "@/lib/site/project-snapshot-schema";
import { injectTailwindCompiledCssIntoStoredPayloadJson } from "@/lib/data/inject-tailwind-compiled-css-into-stored-json";

describe("injectTailwindCompiledCssIntoStoredPayloadJson", () => {
  it("zet CSS in project_snapshot_v1.assets", () => {
    const raw = {
      format: PROJECT_SNAPSHOT_FORMAT,
      meta: {},
      assets: { customCss: "x" },
      sections: [],
    } as unknown as Record<string, unknown>;
    const out = injectTailwindCompiledCssIntoStoredPayloadJson(raw, ".a{color:red}");
    expect(out?.assets).toEqual({ customCss: "x", tailwindCompiledCss: ".a{color:red}" });
  });

  it("zet CSS op root bij losse tailwind payload", () => {
    const raw = { sections: [{ id: "h", sectionName: "H", html: "<p></p>" }] };
    const out = injectTailwindCompiledCssIntoStoredPayloadJson(raw, ".b{}");
    expect(out?.tailwindCompiledCss).toBe(".b{}");
    expect(out?.sections).toEqual(raw.sections);
  });

  it("retourneert null voor onbekende vorm", () => {
    expect(injectTailwindCompiledCssIntoStoredPayloadJson(null, "x")).toBeNull();
    expect(injectTailwindCompiledCssIntoStoredPayloadJson({ foo: 1 }, "x")).toBeNull();
  });
});
