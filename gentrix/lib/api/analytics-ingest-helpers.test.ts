import { describe, expect, it } from "vitest";
import {
  ANALYTICS_PROPERTIES_MAX_BYTES,
  capEventPropertiesSize,
  hashUserAgentForStorage,
  refererForStorage,
} from "@/lib/api/analytics-ingest-helpers";

describe("hashUserAgentForStorage", () => {
  it("geeft korte hash, geen volledige UA", () => {
    const h = hashUserAgentForStorage("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(h).toMatch(/^sha256:[a-f0-9]{32}$/);
    expect(h).not.toContain("Mozilla");
  });
});

describe("refererForStorage", () => {
  it("laat korte referrers door", () => {
    expect(refererForStorage("https://example.com/x")).toBe("https://example.com/x");
  });
  it("hasht lange referrers", () => {
    const long = `https://ex.com/${"a".repeat(600)}`;
    const r = refererForStorage(long);
    expect(r).toMatch(/^sha256ref:/);
    expect(r!.length).toBeLessThan(80);
  });
});

describe("capEventPropertiesSize", () => {
  it("houdt properties onder de cap", () => {
    const big: Record<string, string | number | boolean> = { a: "x".repeat(20_000) };
    const out = capEventPropertiesSize(big, ANALYTICS_PROPERTIES_MAX_BYTES);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(ANALYTICS_PROPERTIES_MAX_BYTES);
  });
});
