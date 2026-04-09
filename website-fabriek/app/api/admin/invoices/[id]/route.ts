import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApiAuth } from "@/lib/auth/require-admin-api";
import { patchInvoiceBodySchema } from "@/lib/commercial/billing-api-schemas";
import { billingErrorResponse } from "@/lib/commercial/billing-api-response";
import { processInvoicePatch } from "@/lib/commercial/invoice-patch-handler";
import type { InvoiceAuditSource } from "@/lib/commercial/invoice-audit";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function auditSourceFromRequest(request: Request): InvoiceAuditSource {
  const h = (request.headers.get("x-audit-source") ?? "").trim().toLowerCase();
  if (h === "admin_ui") return "admin_ui";
  if (h === "quote_conversion") return "quote_conversion";
  if (h === "system") return "system";
  return "api";
}

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_SELECT =
  "id, client_id, deal_id, origin_quote_id, invoice_number, amount, status, due_date, currency, notes, company_name_snapshot, contact_name_snapshot, billing_email_snapshot, billing_phone_snapshot, billing_address_snapshot, billing_postal_code_snapshot, billing_city_snapshot, issued_at, sent_at, paid_at, created_at, clients(name, client_number)";

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const supabase = createServiceRoleClient();
  const { data: inv, error: invErr } = await supabase.from("invoices").select(DETAIL_SELECT).eq("id", id).maybeSingle();

  if (invErr || !inv) {
    return NextResponse.json({ ok: false, error: "Factuur niet gevonden." }, { status: 404 });
  }

  const { data: items, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("id, invoice_id, description, quantity, unit_price, line_total, position, created_at")
    .eq("invoice_id", id)
    .order("position", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { ...inv, items: items ?? [] } });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return billingErrorResponse(400, "INVALID_JSON", "Ongeldige JSON.");
  }
  const parsed = patchInvoiceBodySchema.safeParse(json);
  if (!parsed.success) {
    return billingErrorResponse(400, "VALIDATION_ERROR", parsed.error.message);
  }

  const supabase = createServiceRoleClient();
  const result = await processInvoicePatch(supabase, id, parsed.data, {
    actorUserId: auth.userId,
    auditSource: auditSourceFromRequest(request),
  });

  if (!result.ok) {
    return billingErrorResponse(result.status, result.code, result.message, {
      reasonCode: result.reasonCode,
      severity: result.severity,
    });
  }

  revalidatePath("/admin/invoices");
  revalidatePath("/admin/ops");
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath(`/admin/invoices/${id}/edit`);

  return NextResponse.json({ ok: true, data: result.data });
}
