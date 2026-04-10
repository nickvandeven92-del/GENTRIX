import { afterEach, describe, expect, it } from "vitest";
import { isPrimaryStudioHost } from "@/lib/domains/request-host";

const envSnapshot = { ...process.env };

afterEach(() => {
  process.env = { ...envSnapshot };
});

describe("isPrimaryStudioHost", () => {
  it("is false zonder NEXT_PUBLIC_PRIMARY_HOST", () => {
    delete process.env.NEXT_PUBLIC_PRIMARY_HOST;
    expect(isPrimaryStudioHost("www.example.com")).toBe(false);
  });

  it("matcht primary host (case-insensitive)", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.a.nl";
    expect(isPrimaryStudioHost("www.a.nl")).toBe(true);
    expect(isPrimaryStudioHost("WWW.A.NL")).toBe(true);
    expect(isPrimaryStudioHost("other.nl")).toBe(false);
  });

  it("matcht aliases", () => {
    process.env.NEXT_PUBLIC_PRIMARY_HOST = "www.a.nl";
    process.env.NEXT_PUBLIC_PRIMARY_HOST_ALIASES = "a.nl, app.a.nl";
    expect(isPrimaryStudioHost("a.nl")).toBe(true);
    expect(isPrimaryStudioHost("app.a.nl")).toBe(true);
  });
});
