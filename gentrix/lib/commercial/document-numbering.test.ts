import { describe, expect, it } from "vitest";
import { isPostgresUniqueViolationMessage, parseDocumentSequence } from "@/lib/commercial/document-numbering";

describe("document-numbering helpers", () => {
  it("parseDocumentSequence", () => {
    expect(parseDocumentSequence("INV-2026-007", "INV", 2026)).toBe(7);
    expect(parseDocumentSequence("inv-2026-007", "INV", 2026)).toBe(null);
    expect(parseDocumentSequence("INV-2025-007", "INV", 2026)).toBe(null);
  });

  it("isPostgresUniqueViolationMessage herkent 23505-achtige teksten", () => {
    expect(isPostgresUniqueViolationMessage("duplicate key value violates unique constraint")).toBe(true);
    expect(isPostgresUniqueViolationMessage("23505")).toBe(true);
    expect(isPostgresUniqueViolationMessage("random failure")).toBe(false);
  });
});
