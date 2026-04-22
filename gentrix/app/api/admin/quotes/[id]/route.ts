import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireStudioAdminApiAuth } from "@/lib/auth/require-studio-admin-api";
import { patchQuoteBodySchema } from "@/lib/commercial/billing-api-schemas";
import { createDraftInvoiceFromQuote } from "@/lib/commercial/create-draft-invoice-from-quote";
import { insertInvoiceAuditEvent } from "@/lib/commercial/invoice-audit";
import { mapLineInputsToRows, totalFromLineRows } from "@/lib/commercial/billing-insert-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type Ctx = { params: Promise<{ id: string }> };

const DETAIL_SELECT =
  "id, client_id, deal_id, quote_number, amount, status, valid_until, currency, notes, title, intro_text, scope_text, delivery_text, exclusions_text, terms_text, company_name_snapshot, contact_name_snapshot, billing_email_snapshot, billing_phone_snapshot, billing_address_snapshot, billing_postal_code_snapshot, billing_city_snapshot, issued_at, sent_at, accepted_at, rejected_at, created_at, clients(name, subfolder_slug, client_number)";

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await ctx.params;
  const supabase = createServiceRoleClient();
  const { data: q, error: qErr } = await supabase.from("quotes").select(DETAIL_SELECT).eq("id", id).maybeSingle();

  if (qErr || !q) {
    return NextResponse.json({ ok: false, error: "Offerte niet gevonden." }, { status: 404 });
  }

  const { data: items, error: itemsErr } = await supabase
    .from("quote_items")
    .select("id, quote_id, description, quantity, unit_price, line_total, position, created_at")
    .eq("quote_id", id)
    .order("position", { ascending: true });

  if (itemsErr) {
    return NextResponse.json({ ok: false, error: itemsErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { ...q, items: items ?? [] } });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireStudioAdminApiAuth();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchQuoteBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }
  const p = parsed.data;
  const supabase = createServiceRoleClient();

  const { data: current, error: curErr } = await supabase
    .from("quotes")
    .select("status, sent_at")
    .eq("id", id)
    .single();
  if (curErr || !current) {
    return NextResponse.json({ ok: false, error: "Offerte niet gevonden." }, { status: 404 });
  }

  const cur = current as { status: string; sent_at: string | null };

  const updates: Record<string, unknown> = {};
  const nowIso = new Date().toISOString();

  if (p.valid_until !== undefined) updates.valid_until = p.valid_until;
  if (p.notes !== undefined) updates.notes = p.notes;
  if (p.title !== undefined) updates.title = p.title;
  if (p.intro_text !== undefined) updates.intro_text = p.intro_text;
  if (p.scope_text !== undefined) updates.scope_text = p.scope_text;
  if (p.delivery_text !== undefined) updates.delivery_text = p.delivery_text;
  if (p.exclusions_text !== undefined) updates.exclusions_text = p.exclusions_text;
  if (p.terms_text !== undefined) updates.terms_text = p.terms_text;
  if (p.issued_at !== undefined) updates.issued_at = p.issued_at;

  if (p.company_name_snapshot !== undefined) updates.company_name_snapshot = p.company_name_snapshot;
  if (p.contact_name_snapshot !== undefined) updates.contact_name_snapshot = p.contact_name_snapshot;
  if (p.billing_email_snapshot !== undefined) updates.billing_email_snapshot = p.billing_email_snapshot;
  if (p.billing_phone_snapshot !== undefined) updates.billing_phone_snapshot = p.billing_phone_snapshot;
  if (p.billing_address_snapshot !== undefined) updates.billing_address_snapshot = p.billing_address_snapshot;
  if (p.billing_postal_code_snapshot !== undefined) updates.billing_postal_code_snapshot = p.billing_postal_code_snapshot;
  if (p.billing_city_snapshot !== undefined) updates.billing_city_snapshot = p.billing_city_snapshot;

  if (p.status !== undefined) {
    updates.status = p.status;
    if (p.status === "sent" && !cur.sent_at) {
      updates.sent_at = nowIso;
    }
    if (p.status === "accepted") {
      updates.accepted_at = nowIso;
      updates.rejected_at = null;
    } else if (p.status === "rejected") {
      updates.rejected_at = nowIso;
      updates.accepted_at = null;
    } else {
      updates.accepted_at = null;
      updates.rejected_at = null;
    }
  }

  if (p.replace_items) {
    const lineRows = mapLineInputsToRows(p.replace_items);
    const total = totalFromLineRows(lineRows);
    const { error: delErr } = await supabase.from("quote_items").delete().eq("quote_id", id);
    if (delErr) {
      return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
    }
    const itemInserts = lineRows.map((r) => ({
      quote_id: id,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      line_total: r.line_total,
      position: r.position,
    }));
    const { error: insErr } = await supabase.from("quote_items").insert(itemInserts);
    if (insErr) {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }
    updates.amount = total;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: "Geen velden om bij te werken." }, { status: 400 });
  }

  const { data, error } = await supabase.from("quotes").update(updates).eq("id", id).select("*").single();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "Offerte niet gevonden." }, { status: 404 });
  }

  let draft_invoice_id: string | null = null;
  let draft_invoice_existed = false;
  if (p.status === "accepted") {
    try {
      const r = await createDraftInvoiceFromQuote(supabase, id);
      draft_invoice_id = r.invoiceId;
      draft_invoice_existed = r.alreadyExisted;
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : "Conceptfactuur aanmaken mislukt.",
          quote_updated: true,
        },
        { status: 500 },
      );
    }
    if (draft_invoice_id && !draft_invoice_existed) {
      try {
        await insertInvoiceAuditEvent(supabase, {
          entityId: draft_invoice_id,
          action: "status_changed",
          previousStatus: null,
          nextStatus: "draft",
          invoiceNumberBefore: null,
          invoiceNumberAfter: null,
          actorUserId: auth.userId,
          reasonCode: "CREATED_FROM_QUOTE",
          source: "quote_conversion",
          metadata: { quote_id: id },
        });
      } catch (e) {
        return NextResponse.json(
          {
            ok: false,
            error: e instanceof Error ? e.message : "Auditlog schrijven mislukt.",
            code: "AUDIT_WRITE_FAILED",
            quote_updated: true,
            draft_invoice_id,
          },
          { status: 500 },
        );
      }
    }
  }

  revalidatePath("/admin/quotes");
  revalidatePath("/admin/ops");
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath(`/admin/quotes/${id}/edit`);
  if (draft_invoice_id) {
    revalidatePath(`/admin/invoices/${draft_invoice_id}`);
  }

  return NextResponse.json({
    ok: true,
    data,
    ...(draft_invoice_id ? { draft_invoice_id, draft_invoice_existed } : {}),
  });
}
