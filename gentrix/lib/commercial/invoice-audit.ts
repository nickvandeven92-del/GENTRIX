import type { SupabaseClient } from "@supabase/supabase-js";

export type InvoiceAuditAction =
  | "invoice_number_assigned"
  | "status_changed"
  | "transition_denied";

export type InvoiceAuditSource = "api" | "admin_ui" | "quote_conversion" | "system";

export type InsertInvoiceAuditEventInput = {
  entityId: string;
  action: InvoiceAuditAction;
  previousStatus?: string | null;
  nextStatus?: string | null;
  invoiceNumberBefore?: string | null;
  invoiceNumberAfter?: string | null;
  actorUserId?: string | null;
  reasonCode: string;
  source: InvoiceAuditSource;
  metadata?: Record<string, unknown>;
};

export async function insertInvoiceAuditEvent(
  supabase: SupabaseClient,
  row: InsertInvoiceAuditEventInput,
): Promise<void> {
  const { error } = await supabase.from("invoice_audit_events").insert({
    entity_type: "invoice",
    entity_id: row.entityId,
    action: row.action,
    previous_status: row.previousStatus ?? null,
    next_status: row.nextStatus ?? null,
    invoice_number_before: row.invoiceNumberBefore ?? null,
    invoice_number_after: row.invoiceNumberAfter ?? null,
    actor_user_id: row.actorUserId ?? null,
    reason_code: row.reasonCode,
    source: row.source,
    metadata: row.metadata ?? {},
  });
  if (error) throw new Error(`Auditlog schrijven mislukt: ${error.message}`);
}
