import { describe, expect, it } from "vitest";
import {
  rewriteStudioPreviewExternalScripts,
  stripCrossoriginOnStudioPreviewLibTags,
  STUDIO_PREVIEW_LIB_UPSTREAM,
} from "@/lib/site/studio-preview-lib-registry";

describe("rewriteStudioPreviewExternalScripts", () => {
  it("verwijdert crossorigin op geproxiede script-tags (CORS + null-origin iframe)", () => {
    const upstream = STUDIO_PREVIEW_LIB_UPSTREAM["gsap-core"];
    const html = `<script defer src="${upstream}" crossorigin="anonymous"></script>`;
    const out = rewriteStudioPreviewExternalScripts(html, "https://www.example.com");
    expect(out).toContain("https://www.example.com/api/public/studio-preview-lib?name=gsap-core");
    expect(out).not.toMatch(/crossorigin/i);
  });

  it("verwijdert crossorigin op geproxiede link-stylesheets", () => {
    const upstream = STUDIO_PREVIEW_LIB_UPSTREAM["aos-css"];
    const html = `<link rel="stylesheet" href="${upstream}" crossorigin="anonymous"/>`;
    const out = rewriteStudioPreviewExternalScripts(html, "https://www.example.com");
    expect(out).toContain("name=aos-css");
    expect(out).not.toMatch(/crossorigin/i);
  });
});

describe("stripCrossoriginOnStudioPreviewLibTags", () => {
  it("laat andere scripts met crossorigin ongemoeid", () => {
    const html = `<script src="https://cdn.example.com/x.js" crossorigin="anonymous"></script>`;
    expect(stripCrossoriginOnStudioPreviewLibTags(html)).toBe(html);
  });
});
