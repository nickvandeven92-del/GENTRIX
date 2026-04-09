import { describe, expect, it } from "vitest";
import { parseExactClientNumberQuery, parseExactInvoiceNumberQuery } from "@/lib/commercial/invoice-search";

describe("invoice-search", () => {
  it("parseExactInvoiceNumberQuery herkent INV-patroon case-insensitive", () => {
    expect(parseExactInvoiceNumberQuery("inv-2026-042")).toBe("INV-2026-042");
    expect(parseExactInvoiceNumberQuery("  INV-2026-042  ")).toBe("INV-2026-042");
    expect(parseExactInvoiceNumberQuery("INV-2026-42")).toBe(null);
    expect(parseExactInvoiceNumberQuery("klant")).toBe(null);
  });

  it("parseExactClientNumberQuery herkent CL-patroon", () => {
    expect(parseExactClientNumberQuery("cl-2026-001")).toBe("CL-2026-001");
    expect(parseExactClientNumberQuery("OFF-2026-001")).toBe(null);
  });
});
