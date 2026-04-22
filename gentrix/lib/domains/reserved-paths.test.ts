import { describe, expect, it } from "vitest";
import {
  isCandidateForLandingSitePrettyUrl,
  isReservedTopLevelPath,
} from "@/lib/domains/reserved-paths";

describe("isReservedTopLevelPath", () => {
  it("markeert Next-internals als gereserveerd", () => {
    expect(isReservedTopLevelPath("/_next/static/chunks/x.js")).toBe(true);
    expect(isReservedTopLevelPath("/api/session")).toBe(true);
  });

  it("markeert app-shell routes als gereserveerd", () => {
    expect(isReservedTopLevelPath("/admin")).toBe(true);
    expect(isReservedTopLevelPath("/portal/settings")).toBe(true);
    expect(isReservedTopLevelPath("/dashboard")).toBe(true);
    expect(isReservedTopLevelPath("/site/home")).toBe(true);
    expect(isReservedTopLevelPath("/boek/klant")).toBe(true);
    expect(isReservedTopLevelPath("/winkel/klant")).toBe(true);
  });

  it("markeert static assets als gereserveerd", () => {
    expect(isReservedTopLevelPath("/favicon.ico")).toBe(true);
    expect(isReservedTopLevelPath("/hero.png")).toBe(true);
    expect(isReservedTopLevelPath("/robots.txt")).toBe(true);
  });

  it("markeert root als gereserveerd", () => {
    expect(isReservedTopLevelPath("/")).toBe(true);
    expect(isReservedTopLevelPath("")).toBe(true);
  });

  it("staat marketing-achtige paden toe", () => {
    expect(isReservedTopLevelPath("/werkwijze")).toBe(false);
    expect(isReservedTopLevelPath("/contact")).toBe(false);
    expect(isReservedTopLevelPath("/over-ons")).toBe(false);
    expect(isReservedTopLevelPath("/wat-wij-doen")).toBe(false);
  });
});

describe("isCandidateForLandingSitePrettyUrl", () => {
  it("enkelvoudig segment = OK", () => {
    expect(isCandidateForLandingSitePrettyUrl("/werkwijze")).toBe(true);
    expect(isCandidateForLandingSitePrettyUrl("/contact")).toBe(true);
  });

  it("meerdere segmenten = niet afhandelen via pretty-URL", () => {
    expect(isCandidateForLandingSitePrettyUrl("/werkwijze/detail")).toBe(false);
    expect(isCandidateForLandingSitePrettyUrl("/a/b/c")).toBe(false);
  });

  it("root en reserved paths falsy", () => {
    expect(isCandidateForLandingSitePrettyUrl("/")).toBe(false);
    expect(isCandidateForLandingSitePrettyUrl("/api")).toBe(false);
    expect(isCandidateForLandingSitePrettyUrl("/site/home")).toBe(false);
  });
});
