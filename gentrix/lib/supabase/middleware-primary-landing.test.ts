import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { resolveLandingSiteRootSlug } from "@/lib/supabase/middleware-primary-landing";

const envSnapshot = { ...process.env };

function requestForHost(host: string, pathname = "/") {
  return new NextRequest(new URL(`https://${host}${pathname}`), { headers: { host } });
}

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("resolveLandingSiteRootSlug", () => {
  it("op primary host: standaard home zonder LANDING_SITE_ROOT_SLUG", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.studio.nl";
    delete process.env.LANDING_SITE_ROOT_SLUG;
    expect(resolveLandingSiteRootSlug(requestForHost("www.studio.nl"))).toBe("home");
  });

  it("LANDING_SITE_ROOT_SLUG=off op primary: geen rewrite-slug", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.studio.nl";
    process.env.LANDING_SITE_ROOT_SLUG = "off";
    expect(resolveLandingSiteRootSlug(requestForHost("www.studio.nl"))).toBeNull();
  });

  it("expliciete slug wint op primary", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.studio.nl";
    process.env.LANDING_SITE_ROOT_SLUG = "gentrix";
    expect(resolveLandingSiteRootSlug(requestForHost("www.studio.nl"))).toBe("gentrix");
  });

  it("niet-primary host: geen default home", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.studio.nl";
    delete process.env.LANDING_SITE_ROOT_SLUG;
    expect(resolveLandingSiteRootSlug(requestForHost("preview.vercel.app"))).toBeNull();
  });
});
