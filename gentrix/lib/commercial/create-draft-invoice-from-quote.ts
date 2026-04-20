import type { SupabaseClient } from "@supabase/supabase-js";
import { mapLineInputsToRows, totalFromLineRows } from "@/lib/commercial/billing-insert-helpers";
type QuoteRow = {
  id: string;
  client_id: string;
  deal_id: string | null;
  quote_number: string;
  amount: string | number;
  company_name_snapshot: string | null;
  contact_name_snapshot: string | null;
  billing_email_snapshot: string | null;
  billing_phone_snapshot: string | null;
  billing_address_snapshot: string | null;
  billing_postal_code_snapshot: string | null;
  billing_city_snapshot: string | null;
  notes: string | null;
};

type QuoteItemRow = {
  description: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  position: number;
};

function dueDatePlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Maakt één conceptfactuur per offerte (idempotent via origin_quote_id).
 * Geen mail, geen status verzonden.
 */
export async function createDraftInvoiceFromQuote(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<{ invoiceId: string; alreadyExisted: boolean }> {
  const { data: existing } = await supabase.from("invoices").select("id").eq("origin_quote_id", quoteId).maybeSingle();
  if (existing?.id) {
    return { invoiceId: existing.id as string, alreadyExisted: true };
  }

  const { data: quote, error: qErr } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (qErr || !quote) {
    throw new Error(qErr?.message ?? "Offerte niet gevonden.");
  }
  const q = quote as unknown as QuoteRow;

  const { data: rawItems, error: iErr } = await supabase
    .from("quote_items")
    .select("description, quantity, unit_price, line_total, position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: true });

  if (iErr) {
    throw new Error(iErr.message);
  }
  const items = (rawItems ?? []) as unknown as QuoteItemRow[];
  if (items.length === 0) {
    throw new Error("Offerte heeft geen regels; voeg regels toe vóór acceptatie.");
  }

  const lineInputs = items.map((it) => ({
    description: it.description,
    quantity: typeof it.quantity === "number" ? it.quantity : parseFloat(String(it.quantity)),
    unit_price: typeof it.unit_price === "number" ? it.unit_price : parseFloat(String(it.unit_price)),
  }));
  const lineRows = mapLineInputsToRows(lineInputs);
  const total = totalFromLineRows(lineRows);
  const nowIso = new Date().toISOString();
  const noteTail = q.notes?.trim() ? `\n\nOfferte-opmerkingen:\n${q.notes.trim()}` : "";
  const notes = `Automatisch aangemaakt na acceptatie van offerte ${q.quote_number}.${noteTail}`;

  const insertRow = {
    client_id: q.client_id,
    deal_id: q.deal_id,
    origin_quote_id: quoteId,
    invoice_number: null,
    amount: total,
    due_date: dueDatePlusDays(14),
    status: "draft" as const,
    currency: "EUR",
    notes,
    issued_at: nowIso,
    sent_at: null,
    paid_at: null,
    company_name_snapshot: q.company_name_snapshot,
    contact_name_snapshot: q.contact_name_snapshot,
    billing_email_snapshot: q.billing_email_snapshot,
    billing_phone_snapshot: q.billing_phone_snapshot,
    billing_address_snapshot: q.billing_address_snapshot,
    billing_postal_code_snapshot: q.billing_postal_code_snapshot,
    billing_city_snapshot: q.billing_city_snapshot,
  };

  const { data: inv, error: invErr } = await supabase.from("invoices").insert(insertRow).select("id").single();
  if (invErr || !inv) {
    throw new Error(invErr?.message ?? "Factuur aanmaken mislukt.");
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
    throw new Error(itemsErr.message);
  }

  return { invoiceId, alreadyExisted: false };
}
