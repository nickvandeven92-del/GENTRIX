import { describe, expect, it } from "vitest";
import { createInvoiceBodySchema, patchInvoiceBodySchema } from "@/lib/commercial/billing-api-schemas";

describe("billing-api-schemas invoice", () => {
  it("PATCH is strict: onbekende sleutels zoals invoice_number worden geweigerd", () => {
    const r = patchInvoiceBodySchema.safeParse({
      status: "sent",
      invoice_number: "INV-2099-999",
    });
    expect(r.success).toBe(false);
  });

  it("PATCH accepteert cancelled en confirm_exception_transition", () => {
    const r = patchInvoiceBodySchema.safeParse({
      status: "cancelled",
      confirm_exception_transition: true,
    });
    expect(r.success).toBe(true);
  });

  it("POST create is strict", () => {
    const r = createInvoiceBodySchema.safeParse({
      client_id: "00000000-0000-4000-8000-000000000001",
      due_date: "2026-12-31",
      items: [{ description: "X", quantity: 1, unit_price: 10 }],
      invoice_number: "nope",
    });
    expect(r.success).toBe(false);
  });

  it("POST accepteert geen cancelled status", () => {
    const r = createInvoiceBodySchema.safeParse({
      client_id: "00000000-0000-4000-8000-000000000001",
      due_date: "2026-12-31",
      status: "cancelled",
      items: [{ description: "X", quantity: 1, unit_price: 10 }],
    });
    expect(r.success).toBe(false);
  });
});
