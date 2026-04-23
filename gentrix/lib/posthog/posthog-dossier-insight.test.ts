import { describe, expect, it } from "vitest";
import { getPosthogDossierForClientSlug } from "@/lib/posthog/posthog-dossier-insight";

describe("getPosthogDossierForClientSlug", () => {
  it("weigert onveilige slugs", async () => {
    const v = await getPosthogDossierForClientSlug("x'; --");
    expect(v.kind).toBe("error");
  });
});
