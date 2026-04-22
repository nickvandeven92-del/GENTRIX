import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { createInvoiceBodySchema } from "@/lib/commercial/billing-api-schemas";
import { billingErrorResponse } from "@/lib/commercial/billing-api-response";
import { generateInvoiceNumber } from "@/lib/commercial/document-numbering";
import { insertInvoiceAuditEvent } from "@/lib/commercial/invoice-audit";
import {
  clientSnapshotsFromRow,
  mapLineInputsToRows,
  totalFromLineRows,
} from "@/lib/commercial/billing-insert-helpers";
import { trySendInvoiceSentPortalEmail } from "@/lib/email/invoice-portal-notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const LIST_SELECT =
  "id, client_id, deal_id, invoice_number, amount, status, due_date, paid_at, issued_at, sent_at, currency, created_at, clients(name, client_number)";

export async function GET() {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("invoices").select(LIST_SELECT).order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const actorUserId = auth.userId;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = createInvoiceBodySchema.safeParse(json);
  if (!parsed.success) {
    return billingErrorResponse(400, "VALIDATION_ERROR", parsed.error.message);
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("name, company_legal_name, contact_name, billing_email, phone, billing_address, billing_postal_code, billing_city")
    .eq("id", p.client_id)
    .single();

  if (clientErr || !clientRow) {
    return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 400 });
  }

  const cr = clientRow as Record<string, unknown>;
  const snapshots = clientSnapshotsFromRow({
    name: String(cr.name ?? ""),
    company_legal_name: (cr.company_legal_name as string | null) ?? null,
    contact_name: (cr.contact_name as string | null) ?? null,
    billing_email: (cr.billing_email as string | null) ?? null,
    phone: (cr.phone as string | null) ?? null,
    billing_address: (cr.billing_address as string | null) ?? null,
    billing_postal_code: (cr.billing_postal_code as string | null) ?? null,
    billing_city: (cr.billing_city as string | null) ?? null,
  });
  const lineRows = mapLineInputsToRows(p.items);
  const total = totalFromLineRows(lineRows);
  const nowIso = new Date().toISOString();
  const issuedAt =
    p.issued_at && typeof p.issued_at === "string" && p.issued_at.trim().length > 0
      ? new Date(p.issued_at).toISOString()
      : nowIso;

  let invoiceNumber: string | null = null;
  if (p.status === "sent" || p.status === "paid") {
    try {
      invoiceNumber = await generateInvoiceNumber(supabase);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Factuurnummer genereren mislukt." },
        { status: 500 },
      );
    }
  }

  const insertRow = {
    client_id: p.client_id,
    deal_id: p.deal_id ?? null,
    invoice_number: invoiceNumber,
    amount: total,
    due_date: p.due_date,
    status: p.status,
    currency: "EUR",
    notes: p.notes ?? null,
    issued_at: issuedAt,
    sent_at: p.status === "sent" ? nowIso : null,
    paid_at: p.status === "paid" ? nowIso : null,
    ...snapshots,
  };

  const { data: inv, error: invErr } = await supabase.from("invoices").insert(insertRow).select("id").single();

  if (invErr || !inv) {
    return NextResponse.json({ ok: false, error: invErr?.message ?? "Factuur aanmaken mislukt." }, { status: 500 });
  }

  const invoiceId = inv.id as string;
  const itemInserts = lineRows.map((r) => ({
    invoice_id: invoiceId,
    description: r.description,
    quantity: r.quantity,
    unit_price: r.unit_price,
    line_total: r.line_total,
    position: r.position,
  }));

  const { error: itemsErr } = await supabase.from("invoice_items").insert(itemInserts);
  if (itemsErr) {
    await supabase.from("invoices").delete().eq("id", invoiceId);
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/ops");
  revalidatePath(`/admin/invoices/${invoiceId}`);

  const { data: full } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();

  if (full) {
    const row = full as { status: string; invoice_number: string | null };
    try {
      if (row.invoice_number) {
        await insertInvoiceAuditEvent(supabase, {
          entityId: invoiceId,
          action: "invoice_number_assigned",
          previousStatus: "draft",
          nextStatus: row.status,
          invoiceNumberBefore: null,
          invoiceNumberAfter: row.invoice_number,
          actorUserId,
          reasonCode: "NUMBER_ASSIGNED_ON_CREATE",
          source: "api",
        });
      }
      if (row.status !== "draft") {
        await insertInvoiceAuditEvent(supabase, {
          entityId: invoiceId,
          action: "status_changed",
          previousStatus: null,
          nextStatus: row.status,
          invoiceNumberBefore: null,
          invoiceNumberAfter: row.invoice_number,
          actorUserId,
          reasonCode: "CREATED_WITH_STATUS",
          source: "api",
          metadata: { created: true },
        });
      }
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : "Auditlog schrijven mislukt.",
          code: "AUDIT_WRITE_FAILED",
        },
        { status: 500 },
      );
    }
    const sentRow = full as {
      status: string;
      id: string;
      client_id: string;
      invoice_number: string | null;
    };
    if (sentRow.status === "sent") {
      void trySendInvoiceSentPortalEmail({
        clientId: sentRow.client_id,
        invoiceId: sentRow.id,
        invoiceNumber: sentRow.invoice_number,
      });
    }
  }

  return NextResponse.json({ ok: true, data: full });
}
