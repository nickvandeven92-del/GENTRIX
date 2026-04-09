import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteStatus } from "@/lib/commercial/billing-helpers";

export type QuoteItemRow = {
  id: string;
  quote_id: string;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  position: number;
  created_at: string;
};

const QUOTE_SELECT =
  "id, client_id, deal_id, quote_number, amount, status, valid_until, currency, notes, title, intro_text, scope_text, delivery_text, exclusions_text, terms_text, company_name_snapshot, contact_name_snapshot, billing_email_snapshot, billing_phone_snapshot, billing_address_snapshot, billing_postal_code_snapshot, billing_city_snapshot, issued_at, sent_at, accepted_at, rejected_at, created_at, clients(name, subfolder_slug, client_number)";

export type QuoteDetail = {
  id: string;
  client_id: string;
  deal_id: string | null;
  quote_number: string;
  amount: string | number;
  status: QuoteStatus;
  valid_until: string;
  currency: string;
  notes: string | null;
  title: string | null;
  intro_text: string | null;
  scope_text: string | null;
  delivery_text: string | null;
  exclusions_text: string | null;
  terms_text: string | null;
  company_name_snapshot: string | null;
  contact_name_snapshot: string | null;
  billing_email_snapshot: string | null;
  billing_phone_snapshot: string | null;
  billing_address_snapshot: string | null;
  billing_postal_code_snapshot: string | null;
  billing_city_snapshot: string | null;
  issued_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_at: string;
  clients: { name: string; subfolder_slug: string | null; client_number: string | null } | null;
  items: QuoteItemRow[];
};

export async function getQuoteById(id: string): Promise<QuoteDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: q, error: qErr } = await supabase.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle();

  if (qErr || !q) return null;

  const { data: items, error: itemsErr } = await supabase
    .from("quote_items")
    .select("id, quote_id, description, quantity, unit_price, line_total, position, created_at")
    .eq("quote_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemsErr) return null;

  return {
    ...(q as unknown as Omit<QuoteDetail, "items">),
    items: (items ?? []) as unknown as QuoteItemRow[],
  };
}
