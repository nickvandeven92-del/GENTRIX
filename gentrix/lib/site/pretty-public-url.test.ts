import { describe, expect, it } from "vitest";
import { toPrettyPublicRedirectTarget } from "@/lib/site/pretty-public-url";

describe("toPrettyPublicRedirectTarget", () => {
  const active = { active: true as const, basePathPrefix: "/site/home" };
  const inactive = { active: false as const, basePathPrefix: null };

  it("laat target ongemoeid wanneer pretty-URLs uit staan", () => {
    expect(toPrettyPublicRedirectTarget("/site/home/werkwijze", inactive)).toBe(
      "/site/home/werkwijze",
    );
  });

  it("vervangt basePath door root", () => {
    expect(toPrettyPublicRedirectTarget("/site/home", active)).toBe("/");
  });

  it("vervangt subroute door korte pad", () => {
    expect(toPrettyPublicRedirectTarget("/site/home/werkwijze", active)).toBe("/werkwijze");
  });

  it("behoudt query en hash", () => {
    expect(
      toPrettyPublicRedirectTarget("/site/home/werkwijze?utm=x#services", active),
    ).toBe("/werkwijze?utm=x#services");
  });

  it("laat andere interne paden ongewijzigd", () => {
    expect(toPrettyPublicRedirectTarget("/login", active)).toBe("/login");
    expect(toPrettyPublicRedirectTarget("/site/andere-slug", active)).toBe(
      "/site/andere-slug",
    );
  });
});
