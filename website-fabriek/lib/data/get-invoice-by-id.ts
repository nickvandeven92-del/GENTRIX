import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";

export type InvoiceItemRow = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  position: number;
  created_at: string;
};

const INVOICE_SELECT =
  "id, client_id, deal_id, origin_quote_id, invoice_number, amount, status, due_date, currency, notes, company_name_snapshot, contact_name_snapshot, billing_email_snapshot, billing_phone_snapshot, billing_address_snapshot, billing_postal_code_snapshot, billing_city_snapshot, issued_at, sent_at, paid_at, created_at, clients(name, client_number, subfolder_slug, portal_invoices_enabled)";

export type InvoiceDetail = {
  id: string;
  client_id: string;
  deal_id: string | null;
  origin_quote_id: string | null;
  invoice_number: string | null;
  amount: string | number;
  status: InvoiceStoredStatus;
  due_date: string;
  currency: string;
  notes: string | null;
  company_name_snapshot: string | null;
  contact_name_snapshot: string | null;
  billing_email_snapshot: string | null;
  billing_phone_snapshot: string | null;
  billing_address_snapshot: string | null;
  billing_postal_code_snapshot: string | null;
  billing_city_snapshot: string | null;
  issued_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  clients: {
    name: string;
    client_number: string | null;
    subfolder_slug?: string | null;
    portal_invoices_enabled?: boolean;
  } | null;
  items: InvoiceItemRow[];
};

export async function getInvoiceById(
  id: string,
  supabaseOverride?: SupabaseClient,
): Promise<InvoiceDetail | null> {
  const supabase = supabaseOverride ?? (await createSupabaseServerClient());
  const { data: inv, error: invErr } = await supabase.from("invoices").select(INVOICE_SELECT).eq("id", id).maybeSingle();

  if (invErr || !inv) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("id, invoice_id, description, quantity, unit_price, line_total, position, created_at")
    .eq("invoice_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsErr) return null;

  return {
    ...(inv as unknown as Omit<InvoiceDetail, "items">),
    items: (items ?? []) as unknown as InvoiceItemRow[],
  };
}
