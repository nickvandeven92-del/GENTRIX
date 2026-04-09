import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseInvoiceAmount, type InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";

export type ClientFinancialSummary = {
  outstandingAmount: number;
  openQuotesCount: number;
  activeDealsCount: number;
  lastActivityAt: string | null;
};

function maxIso(dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => Boolean(d));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

export async function getClientFinancialSummary(clientId: string): Promise<ClientFinancialSummary> {
  const supabase = await createSupabaseServerClient();

  const [invOpen, invAllDates, quotesOpen, quotesAllDates, deals, clientRow] = await Promise.all([
    supabase.from("invoices").select("amount, status").eq("client_id", clientId).in("status", ["draft", "sent"]),
    supabase.from("invoices").select("updated_at, created_at").eq("client_id", clientId),
    supabase.from("quotes").select("id, status").eq("client_id", clientId).in("status", ["draft", "sent"]),
    supabase.from("quotes").select("updated_at, created_at").eq("client_id", clientId),
    supabase.from("sales_deals").select("stage, updated_at, created_at").eq("client_id", clientId),
    supabase.from("clients").select("updated_at").eq("id", clientId).maybeSingle(),
  ]);

  const outstanding =
    invOpen.data?.reduce((sum, row) => {
      const r = row as { amount: string | number; status: InvoiceStoredStatus };
      return sum + parseInvoiceAmount(r.amount);
    }, 0) ?? 0;

  const openQuotesCount = quotesOpen.data?.length ?? 0;

  const dealRows = (deals.data ?? []) as { stage: string; updated_at: string; created_at: string }[];
  const activeDealsCount = dealRows.filter((d) => !isClosedDealStage(d.stage)).length;

  const invDates = (invAllDates.data ?? []).flatMap((r) => {
    const x = r as { updated_at?: string; created_at?: string };
    return [x.updated_at, x.created_at];
  });
  const quoteDates = (quotesAllDates.data ?? []).flatMap((r) => {
    const x = r as { updated_at?: string; created_at?: string };
    return [x.updated_at, x.created_at];
  });
  const dealDates = dealRows.flatMap((d) => [d.updated_at, d.created_at]);

  const lastActivityAt = maxIso([
    clientRow.data ? (clientRow.data as { updated_at: string }).updated_at : null,
    ...invDates,
    ...quoteDates,
    ...dealDates,
  ]);

  return {
    outstandingAmount: outstanding,
    openQuotesCount,
    activeDealsCount,
    lastActivityAt,
  };
}

export type ClientFinancialBadge = {
  outstandingAmount: number;
  openQuotesCount: number;
};

/** Voor klantenlijst: openstaand + open offertes per klant-id. */
export async function getClientsFinancialBadgesMap(clientIds: string[]): Promise<Record<string, ClientFinancialBadge>> {
  const empty: Record<string, ClientFinancialBadge> = {};
  if (clientIds.length === 0) return empty;

  const supabase = await createSupabaseServerClient();
  const [invRes, quoteRes] = await Promise.all([
    supabase.from("invoices").select("client_id, amount, status").in("client_id", clientIds).in("status", ["draft", "sent"]),
    supabase.from("quotes").select("client_id, status").in("client_id", clientIds).in("status", ["draft", "sent"]),
  ]);

  for (const id of clientIds) {
    empty[id] = { outstandingAmount: 0, openQuotesCount: 0 };
  }

  for (const row of invRes.data ?? []) {
    const r = row as { client_id: string; amount: string | number };
    if (!empty[r.client_id]) continue;
    empty[r.client_id].outstandingAmount += parseInvoiceAmount(r.amount);
  }

  for (const row of quoteRes.data ?? []) {
    const r = row as { client_id: string };
    if (!empty[r.client_id]) continue;
    empty[r.client_id].openQuotesCount += 1;
  }

  return empty;
}
