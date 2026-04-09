import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isInvoiceOverdue,
  parseInvoiceAmount,
  type InvoiceStoredStatus,
} from "@/lib/commercial/billing-helpers";
import { escapeForIlike, searchTerms } from "@/lib/commercial/ilike-search";
import { parseExactClientNumberQuery, parseExactInvoiceNumberQuery } from "@/lib/commercial/invoice-search";

export type InvoiceRow = {
  id: string;
  client_id: string;
  deal_id: string | null;
  invoice_number: string | null;
  amount: string | number;
  status: InvoiceStoredStatus;
  due_date: string;
  paid_at: string | null;
  issued_at: string | null;
  sent_at: string | null;
  currency: string;
  created_at: string;
};

export type InvoiceWithClient = InvoiceRow & {
  clients: {
    name: string;
    client_number: string | null;
    subfolder_slug?: string | null;
    portal_invoices_enabled?: boolean;
  } | null;
};

const LIST_SELECT =
  "id, client_id, deal_id, invoice_number, amount, status, due_date, paid_at, issued_at, sent_at, currency, created_at, clients(name, client_number, subfolder_slug, portal_invoices_enabled)";

function startOfMonthLocalISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function endOfMonthLocalISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

export type ListInvoicesOptions = {
  clientId?: string;
  search?: string | null;
  status?: InvoiceStoredStatus | null;
  /** Overschrijf sessie-client (bijv. service role voor studio-preview). */
  supabase?: SupabaseClient;
};

export async function listInvoices(options?: ListInvoicesOptions): Promise<InvoiceWithClient[]> {
  const supabase = options?.supabase ?? (await createSupabaseServerClient());
  let q = supabase.from("invoices").select(LIST_SELECT).order("created_at", { ascending: false });
  if (options?.clientId) {
    q = q.eq("client_id", options.clientId);
  }
  const term = searchTerms(options?.search ?? undefined);
  if (term) {
    const invExact = parseExactInvoiceNumberQuery(term);
    const clExact = parseExactClientNumberQuery(term);
    if (invExact) {
      q = q.eq("invoice_number", invExact);
    } else if (clExact) {
      q = q.eq("clients.client_number", clExact);
    } else {
      const pattern = `%${escapeForIlike(term)}%`;
      q = q.or(`invoice_number.ilike.${pattern},clients.name.ilike.${pattern},clients.client_number.ilike.${pattern}`);
    }
  }
  if (options?.status) {
    q = q.eq("status", options.status);
  }
  const { data, error } = await q;

  if (error || !data) return [];
  return data as unknown as InvoiceWithClient[];
}

export async function listOverdueInvoices(): Promise<InvoiceWithClient[]> {
  const all = await listInvoices();
  return all.filter((inv) => isInvoiceOverdue(inv));
}

export async function countOverdueInvoices(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, status, due_date")
    .in("status", ["draft", "sent"]);
  if (error || !data) return 0;
  return data.filter((row) => isInvoiceOverdue(row as { status: InvoiceStoredStatus; due_date: string })).length;
}

export async function getRevenueThisMonth(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const from = startOfMonthLocalISO();
  const to = endOfMonthLocalISO();
  const { data, error } = await supabase
    .from("invoices")
    .select("amount")
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .gte("paid_at", from)
    .lte("paid_at", to);

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + parseInvoiceAmount((row as { amount: string | number }).amount), 0);
}

/** Concept + verzonden (niet betaald). Achterstallig zit hierin. */
export async function getOutstandingAmount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("invoices").select("amount").in("status", ["draft", "sent"]);

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + parseInvoiceAmount((row as { amount: string | number }).amount), 0);
}

/** Recent als “verzonden” gemarkeerd (sortering op verstuurd-datum of anders aangemaakt). */
export async function listRecentlySentInvoices(limit = 5): Promise<InvoiceWithClient[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("invoices").select(LIST_SELECT).eq("status", "sent").limit(40);

  if (error || !data) return [];
  const rows = data as unknown as InvoiceWithClient[];
  rows.sort((a, b) => {
    const ta = new Date(a.sent_at ?? a.created_at).getTime();
    const tb = new Date(b.sent_at ?? b.created_at).getTime();
    return tb - ta;
  });
  return rows.slice(0, limit);
}

/** Openstaand met verval binnen `days` dagen. */
export async function listInvoicesDueWithinDays(days: number, limit = 8): Promise<InvoiceWithClient[]> {
  const supabase = await createSupabaseServerClient();
  const end = new Date();
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("invoices")
    .select(LIST_SELECT)
    .in("status", ["draft", "sent"])
    .gte("due_date", today)
    .lte("due_date", endStr)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as unknown as InvoiceWithClient[];
}
