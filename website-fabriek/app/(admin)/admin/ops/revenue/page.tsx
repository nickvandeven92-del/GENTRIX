import type { Metadata } from "next";
import Link from "next/link";
import { RevenueSnapshot } from "@/components/sales-os/overview/revenue-snapshot";
import { OpsBillingMetrics } from "@/components/sales-os/overview/ops-billing-metrics";
import { OpsBillingCashflowLists } from "@/components/sales-os/overview/ops-billing-cashflow-lists";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { listSalesDeals } from "@/lib/data/sales-deals";
import { buildRevenueSnapshotMetrics } from "@/lib/sales-os/signals";
import {
  countOpenQuotes,
  listQuotesExpiringWithinDays,
} from "@/lib/data/list-quotes";
import {
  countOverdueInvoices,
  getOutstandingAmount,
  getRevenueThisMonth,
  listInvoicesDueWithinDays,
  listOverdueInvoices,
  listRecentlySentInvoices,
} from "@/lib/data/list-invoices";
import { formatCurrencyEUR, getInvoiceListStatusLabel, parseInvoiceAmount } from "@/lib/commercial/billing-helpers";

export const metadata: Metadata = {
  title: "Omzet & financiën",
};

export default async function SalesOpsRevenuePage() {
  const [
    deals,
    clients,
    revenueThisMonth,
    outstanding,
    overdueCount,
    openQuotesCount,
    recentSentInvoices,
    invoicesDueSoon,
    quotesExpiringSoon,
    overdueInvoices,
  ] = await Promise.all([
    listSalesDeals(),
    listAdminClients(),
    getRevenueThisMonth(),
    getOutstandingAmount(),
    countOverdueInvoices(),
    countOpenQuotes(),
    listRecentlySentInvoices(5),
    listInvoicesDueWithinDays(14, 8),
    listQuotesExpiringWithinDays(14, 8),
    listOverdueInvoices(),
  ]);

  const metrics = buildRevenueSnapshotMetrics(deals, clients);
  const overdueShown = overdueInvoices.slice(0, 10);

  return (
    <div className="mx-auto max-w-[1000px] space-y-10 pb-16">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Omzet & financiën</h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Pijplijn en abonnementen naast facturen en offertes. Geen boekhoudpakket — wel zicht op cashflow.
        </p>
      </div>

      <OpsBillingMetrics
        revenueThisMonth={revenueThisMonth}
        outstanding={outstanding}
        overdueCount={overdueCount}
        openQuotesCount={openQuotesCount}
      />

      <OpsBillingCashflowLists
        recentSent={recentSentInvoices}
        dueSoon={invoicesDueSoon}
        expiringQuotes={quotesExpiringSoon}
      />

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/90">Achterstallige facturen</h2>
        <p className="mt-1 text-[12px] text-neutral-600">Nog niet betaald en vervaldatum voorbij.</p>
        {overdueShown.length === 0 ? (
          <p className="mt-3 text-[12px] text-neutral-500">Geen achterstallige facturen.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {overdueShown.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                <Link href={`/admin/invoices/${r.id}`} className="font-medium text-neutral-900 hover:underline">
                  <span className="font-mono text-[11px]">{r.invoice_number ?? "Concept"}</span>
                  <span className="ml-2 text-neutral-600">{r.clients?.name ?? "—"}</span>
                </Link>
                <span className="tabular-nums text-neutral-800">{formatCurrencyEUR(parseInvoiceAmount(r.amount))}</span>
                <span className="text-neutral-500">
                  {getInvoiceListStatusLabel({
                    status: r.status,
                    due_date: r.due_date,
                    paid_at: r.paid_at,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RevenueSnapshot metrics={metrics} />

      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Uitsplitsingen</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
          Pakket- en segment-splitsingen vereisen bedrag per klant in de database (nu niet opgeslagen). Gebruik deals
          voor pijplijnwaarde en het veld <span className="font-medium text-neutral-700">Verloopt op</span> (abonnement)
          op de klant voor verlengingen. Zie ook{" "}
          <Link href="/admin/invoices" className="font-medium text-neutral-800 underline">
            Facturen
          </Link>{" "}
          voor betaalde omzet.
        </p>
      </div>
    </div>
  );
}
