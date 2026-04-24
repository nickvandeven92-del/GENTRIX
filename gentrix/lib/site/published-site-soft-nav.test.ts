import { describe, expect, it } from "vitest";
import { isPublishedSiteSoftNavTarget } from "@/lib/site/published-site-soft-nav";

describe("isPublishedSiteSoftNavTarget", () => {
  const slug = "acme-corp";
  const pretty = { siteSlug: slug, prettyPublicUrls: true as const };
  const prefixed = { siteSlug: slug, prettyPublicUrls: false as const };

  it("pretty host: home, contact, single marketing segment", () => {
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/"), pretty)).toBe(true);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/contact"), pretty)).toBe(true);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/werkwijze"), pretty)).toBe(true);
  });

  it("pretty host: rejects reserved top-level segments", () => {
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/admin"), pretty)).toBe(false);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/api/foo"), pretty)).toBe(false);
  });

  it("internal /site/{slug} and subpaths", () => {
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/site/acme-corp"), prefixed)).toBe(true);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/site/acme-corp/"), prefixed)).toBe(true);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/site/acme-corp/contact"), prefixed)).toBe(
      true,
    );
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/site/acme-corp/werkwijze"), prefixed)).toBe(
      true,
    );
  });

  it("does not match another site slug under /site/", () => {
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/site/other-corp"), prefixed)).toBe(false);
  });

  it("preview path prefix", () => {
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/preview/acme-corp"), prefixed)).toBe(true);
    expect(isPublishedSiteSoftNavTarget(new URL("https://example.com/preview/acme-corp/werkwijze"), prefixed)).toBe(
      true,
    );
  });
});
