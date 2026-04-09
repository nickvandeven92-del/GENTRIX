import { describe, expect, it } from "vitest";
import {
  buildContentClaimDiagnosticsReport,
  diagnoseInventedMarketingClaims,
  hasErrorSeverityClaim,
} from "@/lib/ai/content-claim-diagnostics";

describe("diagnoseInventedMarketingClaims", () => {
  it("detecteert Black Friday en korting (error)", () => {
    const html = `<section>Black Friday: 30% korting vandaag!</section>`;
    const d = diagnoseInventedMarketingClaims(html);
    expect(d.some((x) => x.code === "invented_promotion")).toBe(true);
    expect(d.some((x) => x.code === "invented_discount")).toBe(true);
    expect(hasErrorSeverityClaim(d)).toBe(true);
  });

  it("detecteert trusted by (warn) en limited time (error)", () => {
    const html = `Trusted by 500+ companies — limited time offer`;
    const d = diagnoseInventedMarketingClaims(html);
    expect(d.some((x) => x.code === "invented_social_proof")).toBe(true);
    expect(d.some((x) => x.code === "invented_urgency")).toBe(true);
    expect(hasErrorSeverityClaim(d)).toBe(true);
  });

  it("detecteert prijs- en marktleider-taal", () => {
    const html = `Vanaf €199/maand — de marktleider in SaaS.`;
    const d = diagnoseInventedMarketingClaims(html);
    expect(d.some((x) => x.code === "invented_pricing")).toBe(true);
    expect(d.some((x) => x.code === "invented_market_leadership")).toBe(true);
  });

  it("buildContentClaimDiagnosticsReport telt errors en warns", () => {
    const html = `<p>Gratis verzending en Black Friday</p>`;
    const r = buildContentClaimDiagnosticsReport(html);
    expect(r.items.some((i) => i.code === "invented_shipping")).toBe(true);
    expect(r.items.some((i) => i.code === "invented_promotion")).toBe(true);
    expect(r.errorCount).toBe(r.items.filter((i) => i.severity === "error").length);
    expect(r.warnCount).toBe(r.items.filter((i) => i.severity === "warn").length);
    expect(r.items.every((i) => i.fragment.length > 0)).toBe(true);
  });

  it("schone neutrale copy → geen treffers", () => {
    const html = `<p>Neem contact op voor meer informatie over onze diensten.</p>`;
    expect(diagnoseInventedMarketingClaims(html)).toEqual([]);
  });

  it("detecteert verzonnen jaren/projecten en online-sinds (warn)", () => {
    const html = `25+ jaar ervaring — 500+ projecten — online sinds 1998`;
    const d = diagnoseInventedMarketingClaims(html);
    expect(d.every((x) => x.severity === "warn")).toBe(true);
    expect(d.some((x) => x.code === "invented_social_proof")).toBe(true);
    expect(hasErrorSeverityClaim(d)).toBe(false);
  });
});
