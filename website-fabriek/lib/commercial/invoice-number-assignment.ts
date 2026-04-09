import type { SupabaseClient } from "@supabase/supabase-js";
import { assignDefinitiveInvoiceNumber } from "@/lib/commercial/document-numbering";
import { insertInvoiceAuditEvent, type InvoiceAuditSource } from "@/lib/commercial/invoice-audit";

/**
 * Centrale toewijzing van een definitief factuurnummer aan een bestaande rij.
 *
 * Waarom retry in assignDefinitiveInvoiceNumber?
 * Twee gelijktijdige requests lezen dezelfde MAX+1; de tweede UPDATE krijgt 23505 op de partial unique index.
 * De retry-lus leest opnieuw en probeert het volgende vrije nummer. Zo blijft elk factuur-id aan precies één definitief nummer gekoppeld
 * (UPDATE … WHERE id = $id AND invoice_number IS NULL voorkomt dat een tweede nummer op dezelfde rij wordt gezet).
 *
 * Wat is níet 100% atomisch zonder DB-counter?
 * Tussen “voorstel genereren” en “UPDATE gelukt” kan een gat in de reeks ontstaan bij harde crashes; dat is acceptabel voor veel MKB-flows.
 * Betere opvolger: PostgreSQL-sequence of dedicated counter-rij per (jaar, prefix) in één `INSERT … RETURNING` / `SELECT nextval` binnen één transactie.
 */
export type EnsureInvoiceNumberOptions = {
  /**
   * Als de rij in de DB nog `draft` is maar deze request naar `sent`/`paid` gaat,
   * moet het nummer tóch worden toegekend vóór de status-UPDATE de CHECK triggert.
   */
  assignIfTransitioningTo?: "sent" | "paid";
  actorUserId?: string | null;
  auditSource?: InvoiceAuditSource;
  /** Alleen audit bij nieuwe toekenning */
  skipAudit?: boolean;
};

export type EnsureInvoiceNumberResult = {
  invoiceNumber: string;
  wasNewAssignment: boolean;
};

export class InvoiceNumberAssignmentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InvoiceNumberAssignmentError";
    this.code = code;
  }
}

export async function ensureInvoiceHasDefinitiveNumber(
  supabase: SupabaseClient,
  invoiceId: string,
  options?: EnsureInvoiceNumberOptions,
): Promise<EnsureInvoiceNumberResult> {
  const { data: row, error: readErr } = await supabase
    .from("invoices")
    .select("invoice_number, status")
    .eq("id", invoiceId)
    .maybeSingle();

  if (readErr) {
    throw new InvoiceNumberAssignmentError("INVOICE_READ_FAILED", readErr.message);
  }
  if (!row) {
    throw new InvoiceNumberAssignmentError("INVOICE_NOT_FOUND", "Factuur niet gevonden.");
  }

  const num = row.invoice_number as string | null;
  if (num && String(num).trim().length > 0) {
    return { invoiceNumber: String(num), wasNewAssignment: false };
  }

  const st = row.status as string;
  const target = options?.assignIfTransitioningTo;
  const needsNumber =
    st === "sent" ||
    st === "paid" ||
    target === "sent" ||
    target === "paid";

  if (!needsNumber) {
    throw new InvoiceNumberAssignmentError(
      "INVOICE_NUMBER_NOT_ELIGIBLE",
      "Er kan nog geen definitief factuurnummer worden toegekend voor deze status.",
    );
  }

  const beforeNull = num;
  const { invoiceNumber: finalNumber, assigned: didAssign } = await assignDefinitiveInvoiceNumber(supabase, invoiceId);

  if (didAssign && !options?.skipAudit) {
    await insertInvoiceAuditEvent(supabase, {
      entityId: invoiceId,
      action: "invoice_number_assigned",
      previousStatus: st,
      nextStatus: st,
      invoiceNumberBefore: beforeNull,
      invoiceNumberAfter: finalNumber,
      actorUserId: options?.actorUserId,
      reasonCode: "NUMBER_ASSIGNED",
      source: options?.auditSource ?? "api",
      metadata: target ? { pending_transition: target } : {},
    });
  }

  return { invoiceNumber: finalNumber, wasNewAssignment: didAssign };
}
