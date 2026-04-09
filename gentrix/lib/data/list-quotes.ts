import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteStatus } from "@/lib/commercial/billing-helpers";
import { escapeForIlike, searchTerms } from "@/lib/commercial/ilike-search";

export type { QuoteStatus };

export type QuoteRow = {
  id: string;
  client_id: string;
  deal_id: string | null;
  quote_number: string;
  amount: string | number;
  status: QuoteStatus;
  valid_until: string;
  issued_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type QuoteWithClient = QuoteRow & {
  clients: { name: string; client_number: string | null } | null;
};

const LIST_SELECT =
  "id, client_id, deal_id, quote_number, amount, status, valid_until, issued_at, sent_at, created_at, clients(name, client_number)";

export type ListQuotesOptions = {
  clientId?: string;
  search?: string | null;
  status?: QuoteStatus | null;
};

export async function listQuotes(options?: ListQuotesOptions): Promise<QuoteWithClient[]> {
  const supabase = await createSupabaseServerClient();
  let q = supabase.from("quotes").select(LIST_SELECT).order("created_at", { ascending: false });
  if (options?.clientId) {
    q = q.eq("client_id", options.clientId);
  }
  const term = searchTerms(options?.search ?? undefined);
  if (term) {
    const pattern = `%${escapeForIlike(term)}%`;
    q = q.or(`quote_number.ilike.${pattern},clients.name.ilike.${pattern},clients.client_number.ilike.${pattern}`);
  }
  if (options?.status) {
    q = q.eq("status", options.status);
  }
  const { data, error } = await q;

  if (error || !data) return [];
  return data as unknown as QuoteWithClient[];
}

export async function getQuoteAcceptanceRate(): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("quotes").select("status").in("status", ["accepted", "rejected"]);

  if (error || !data?.length) return null;
  const accepted = data.filter((r) => (r as { status: string }).status === "accepted").length;
  const rejected = data.filter((r) => (r as { status: string }).status === "rejected").length;
  const decided = accepted + rejected;
  if (decided === 0) return null;
  return accepted / decided;
}

export async function countOpenQuotes(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .in("status", ["draft", "sent"]);

  if (error) return 0;
  return count ?? 0;
}

/** Offertes waarvan geldigheid binnen `days` verloopt. */
export async function listQuotesExpiringWithinDays(days: number, limit = 8): Promise<QuoteWithClient[]> {
  const supabase = await createSupabaseServerClient();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("quotes")
    .select(LIST_SELECT)
    .in("status", ["draft", "sent"])
    .gte("valid_until", today)
    .lte("valid_until", endStr)
    .order("valid_until", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as QuoteWithClient[];
}
