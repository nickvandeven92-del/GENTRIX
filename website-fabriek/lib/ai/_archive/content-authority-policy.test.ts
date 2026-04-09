import { describe, expect, it } from "vitest";
import {
  buildContentAuthorityPolicyBlock,
  CONTENT_AUTHORITY_POLICY_VERSION,
  getContentAuthorityRulesSummary,
} from "@/lib/ai/content-authority-policy";

describe("content-authority-policy", () => {
  it("buildContentAuthorityPolicyBlock bevat harde verboden en fallback", () => {
    const b = buildContentAuthorityPolicyBlock();
    expect(b).toContain("CONTENT AUTHORITY");
    expect(b).toMatch(/Absence of data is not permission to invent/i);
    expect(b).toMatch(/Black Friday/i);
    expect(b).toMatch(/testimonials/i);
    expect(b).toMatch(/prijzen/i);
    expect(b).toMatch(/neutrale/i);
  });

  it("policy version en summary voor debug", () => {
    expect(CONTENT_AUTHORITY_POLICY_VERSION).toBe("v1");
    expect(getContentAuthorityRulesSummary().length).toBeGreaterThanOrEqual(4);
    expect(getContentAuthorityRulesSummary().join(" ")).toMatch(/no_invented/);
  });
});
