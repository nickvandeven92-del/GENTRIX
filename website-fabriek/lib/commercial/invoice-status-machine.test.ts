import { describe, expect, it } from "vitest";
import {
  invoiceTransitionRequiresConfirmation,
  validateInvoiceStatusTransition,
} from "@/lib/commercial/invoice-status-machine";

describe("invoice-status-machine", () => {
  it("draft -> sent is standaard toegestaan", () => {
    const r = validateInvoiceStatusTransition("draft", "sent", {});
    expect(r.allowed).toBe(true);
    expect(r.requiresAuditLog).toBe(true);
    expect(r.requiresConfirmation).toBe(false);
  });

  it("sent -> paid behoudt nummer-pad", () => {
    const r = validateInvoiceStatusTransition("sent", "paid", {});
    expect(r.allowed).toBe(true);
    expect(r.reasonCode).toBe("SENT_TO_PAID");
  });

  it("draft -> paid vereist bevestiging", () => {
    const r0 = validateInvoiceStatusTransition("draft", "paid", { confirmed: false });
    expect(r0.allowed).toBe(false);
    expect(r0.requiresConfirmation).toBe(true);
    expect(r0.reasonCode).toBe("DRAFT_TO_PAID_NEEDS_CONFIRMATION");

    const r1 = validateInvoiceStatusTransition("draft", "paid", { confirmed: true });
    expect(r1.allowed).toBe(true);
    expect(r1.reasonCode).toBe("DRAFT_TO_PAID_EXCEPTION");
    expect(r1.requiresAuditLog).toBe(true);
  });

  it("sent -> draft vereist bevestiging", () => {
    const r0 = validateInvoiceStatusTransition("sent", "draft", { confirmed: false });
    expect(r0.allowed).toBe(false);
    expect(r0.requiresConfirmation).toBe(true);

    const r1 = validateInvoiceStatusTransition("sent", "draft", { confirmed: true });
    expect(r1.allowed).toBe(true);
    expect(r1.reasonCode).toBe("SENT_TO_DRAFT_EXCEPTION");
  });

  it("paid -> draft is geblokkeerd", () => {
    const r = validateInvoiceStatusTransition("paid", "draft", { confirmed: true });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("PAID_DOWNGRADE_BLOCKED");
    expect(r.requiresAuditLog).toBe(true);
  });

  it("paid -> cancelled vereist bevestiging", () => {
    const r0 = validateInvoiceStatusTransition("paid", "cancelled", { confirmed: false });
    expect(r0.requiresConfirmation).toBe(true);
    const r1 = validateInvoiceStatusTransition("paid", "cancelled", { confirmed: true });
    expect(r1.allowed).toBe(true);
  });

  it("cancelled -> * is geblokkeerd", () => {
    const r = validateInvoiceStatusTransition("cancelled", "draft", {});
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("FROM_CANCELLED_BLOCKED");
  });

  it("zelfde status is no-op", () => {
    const r = validateInvoiceStatusTransition("sent", "sent", {});
    expect(r.allowed).toBe(true);
    expect(r.reasonCode).toBe("NOOP_SAME_STATUS");
  });

  it("invoiceTransitionRequiresConfirmation sluit aan op validate", () => {
    expect(invoiceTransitionRequiresConfirmation("draft", "sent")).toBe(false);
    expect(invoiceTransitionRequiresConfirmation("draft", "paid")).toBe(true);
    expect(invoiceTransitionRequiresConfirmation("sent", "draft")).toBe(true);
  });
});
