import type { SupabaseClient } from "@supabase/supabase-js";
import type { PatchInvoiceBody } from "@/lib/commercial/billing-api-schemas";
import { mapLineInputsToRows, totalFromLineRows } from "@/lib/commercial/billing-insert-helpers";
import { insertInvoiceAuditEvent, type InvoiceAuditSource } from "@/lib/commercial/invoice-audit";
import {
  ensureInvoiceHasDefinitiveNumber,
  InvoiceNumberAssignmentError,
} from "@/lib/commercial/invoice-number-assignment";
import { trySendInvoiceSentPortalEmail } from "@/lib/email/invoice-portal-notifications";
import { validateInvoiceStatusTransition } from "@/lib/commercial/invoice-status-machine";

type CurrentRow = {
  status: string;
  sent_at: string | null;
  paid_at: string | null;
  invoice_number: string | null;
};

export type InvoicePatchHandlerResult =
  | { ok: true; data: Record<string, unknown> }
  | {
      ok: false;
      status: number;
      code: string;
      message: string;
      reasonCode?: string;
      severity?: "info" | "warning" | "error";
    };

async function logDenied(
  supabase: SupabaseClient,
  invoiceId: string,
  cur: CurrentRow,
  toStatus: string,
  actorUserId: string | null,
  source: InvoiceAuditSource,
  reasonCode: string,
): Promise<void> {
  try {
    await insertInvoiceAuditEvent(supabase, {
      entityId: invoiceId,
      action: "transition_denied",
      previousStatus: cur.status,
      nextStatus: toStatus,
      invoiceNumberBefore: cur.invoice_number,
      invoiceNumberAfter: cur.invoice_number,
      actorUserId,
      reasonCode,
      source,
      metadata: { severity: "error" },
    });
  } catch (e) {
    console.error("[invoice audit] transition_denied log failed", e);
  }
}

export async function processInvoicePatch(
  supabase: SupabaseClient,
  invoiceId: string,
  p: PatchInvoiceBody,
  ctx: { actorUserId: string | null; auditSource: InvoiceAuditSource },
): Promise<InvoicePatchHandlerResult> {
  const { data: current, error: curErr } = await supabase
    .from("invoices")
    .select("status, sent_at, paid_at, invoice_number")
    .eq("id", invoiceId)
    .single();

  if (curErr || !current) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Factuur niet gevonden." };
  }

  const cur = current as CurrentRow;
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {};

  if (p.due_date !== undefined) updates.due_date = p.due_date;
  if (p.notes !== undefined) updates.notes = p.notes;
  if (p.issued_at !== undefined) updates.issued_at = p.issued_at;

  const nextStatus = (p.status !== undefined ? p.status : cur.status) as string;

  let transitionMeta: ReturnType<typeof validateInvoiceStatusTransition> | null = null;

  if (p.status !== undefined && p.status !== cur.status) {
    const tv = validateInvoiceStatusTransition(cur.status, p.status, {
      confirmed: Boolean(p.confirm_exception_transition),
    });
    transitionMeta = tv;

    if (!tv.allowed) {
      if (tv.requiresConfirmation) {
        return {
          ok: false,
          status: 400,
          code: "CONFIRMATION_REQUIRED",
          message: tv.userMessage,
          reasonCode: tv.reasonCode,
          severity: tv.severity,
        };
      }
      await logDenied(supabase, invoiceId, cur, p.status, ctx.actorUserId, ctx.auditSource, tv.reasonCode);
      return {
        ok: false,
        status: 400,
        code: "INVALID_STATUS_TRANSITION",
        message: tv.userMessage,
        reasonCode: tv.reasonCode,
        severity: tv.severity,
      };
    }
  }

  if ((nextStatus === "sent" || nextStatus === "paid") && !cur.invoice_number) {
    try {
      await ensureInvoiceHasDefinitiveNumber(supabase, invoiceId, {
        assignIfTransitioningTo: nextStatus === "sent" || nextStatus === "paid" ? nextStatus : undefined,
        actorUserId: ctx.actorUserId,
        auditSource: ctx.auditSource,
      });
    } catch (e) {
      if (e instanceof InvoiceNumberAssignmentError) {
        return { ok: false, status: 400, code: e.code, message: e.message };
      }
      return {
        ok: false,
        status: 500,
        code: "INVOICE_NUMBER_FAILED",
        message: e instanceof Error ? e.message : "Factuurnummer toekennen mislukt.",
      };
    }
  }

  if (p.status !== undefined) {
    updates.status = p.status;
    if (p.status === "paid") {
      updates.paid_at =
        p.paid_at !== undefined && p.paid_at !== null && String(p.paid_at).length > 0 ? p.paid_at : nowIso;
    } else if (p.status === "cancelled" && cur.status === "paid") {
      updates.paid_at = p.paid_at !== undefined ? p.paid_at : cur.paid_at;
    } else {
      updates.paid_at = null;
    }

    if (p.status === "sent" && p.sent_at === undefined && !cur.sent_at) {
      updates.sent_at = nowIso;
    }
    if (p.status === "draft" && p.sent_at === undefined) {
      updates.sent_at = null;
    }
  } else if (p.paid_at !== undefined) {
    updates.paid_at = p.paid_at;
  }

  if (p.sent_at !== undefined) {
    updates.sent_at = p.sent_at;
  }

  if (p.replace_items) {
    const lineRows = mapLineInputsToRows(p.replace_items);
    const total = totalFromLineRows(lineRows);
    const { error: delErr } = await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (delErr) {
      return { ok: false, status: 500, code: "ITEMS_DELETE_FAILED", message: delErr.message };
    }
    const itemInserts = lineRows.map((r) => ({
      invoice_id: invoiceId,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      line_total: r.line_total,
      position: r.position,
    }));
    const { error: insErr } = await supabase.from("invoice_items").insert(itemInserts);
    if (insErr) {
      return { ok: false, status: 500, code: "ITEMS_INSERT_FAILED", message: insErr.message };
    }
    updates.amount = total;
  }

  if (Object.keys(updates).length === 0) {
    const { data: full, error: fullErr } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
    if (fullErr || !full) {
      return { ok: false, status: 404, code: "NOT_FOUND", message: "Factuur niet gevonden." };
    }
    return { ok: true, data: full as Record<string, unknown> };
  }

  const { data, error } = await supabase.from("invoices").update(updates).eq("id", invoiceId).select("*").single();
  if (error) {
    return { ok: false, status: 500, code: "UPDATE_FAILED", message: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "Factuur niet gevonden." };
  }

  const row = data as Record<string, unknown> & {
    status: string;
    invoice_number: string | null;
    client_id: string;
  };

  if (p.status !== undefined && p.status !== cur.status && transitionMeta) {
    try {
      await insertInvoiceAuditEvent(supabase, {
        entityId: invoiceId,
        action: "status_changed",
        previousStatus: cur.status,
        nextStatus: p.status,
        invoiceNumberBefore: cur.invoice_number,
        invoiceNumberAfter: row.invoice_number,
        actorUserId: ctx.actorUserId,
        reasonCode: transitionMeta.reasonCode,
        source: ctx.auditSource,
        metadata: {
          requiresAuditLog: transitionMeta.requiresAuditLog,
          severity: transitionMeta.severity,
        },
      });
    } catch (e) {
      return {
        ok: false,
        status: 500,
        code: "AUDIT_WRITE_FAILED",
        message: e instanceof Error ? e.message : "Auditlog schrijven mislukt.",
      };
    }
  }

  if (p.status === "sent" && cur.status !== "sent" && row.client_id) {
    void trySendInvoiceSentPortalEmail({
      clientId: row.client_id,
      invoiceId,
      invoiceNumber: row.invoice_number,
    });
  }

  return { ok: true, data: row as Record<string, unknown> };
}
