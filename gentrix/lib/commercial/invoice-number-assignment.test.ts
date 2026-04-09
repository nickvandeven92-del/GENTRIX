import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureInvoiceHasDefinitiveNumber,
  InvoiceNumberAssignmentError,
} from "@/lib/commercial/invoice-number-assignment";

describe("ensureInvoiceHasDefinitiveNumber", () => {
  it("geeft bestaand nummer terug zonder assign (idempotent)", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { invoice_number: "INV-2026-010", status: "sent" },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const r = await ensureInvoiceHasDefinitiveNumber(supabase, "id-1", { skipAudit: true });
    expect(r.invoiceNumber).toBe("INV-2026-010");
    expect(r.wasNewAssignment).toBe(false);
  });

  it("concept zonder pending transition: niet in aanmerking voor nummer", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { invoice_number: null, status: "draft" },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(ensureInvoiceHasDefinitiveNumber(supabase, "id-2", { skipAudit: true })).rejects.toMatchObject({
      code: "INVOICE_NUMBER_NOT_ELIGIBLE",
    });
    await expect(ensureInvoiceHasDefinitiveNumber(supabase, "id-2", { skipAudit: true })).rejects.toBeInstanceOf(
      InvoiceNumberAssignmentError,
    );
  });
});
