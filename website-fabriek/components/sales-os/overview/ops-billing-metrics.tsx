import Link from "next/link";
import { formatCurrencyEUR, getInvoiceStatusLabel } from "@/lib/commercial/billing-helpers";

type OpsBillingMetricsProps = {
  revenueThisMonth: number;
  outstanding: number;
  overdueCount: number;
  openQuotesCount: number;
};

export function OpsBillingMetrics({
  revenueThisMonth,
  outstanding,
  overdueCount,
  openQuotesCount,
}: OpsBillingMetricsProps) {
  return (
    <section aria-label="Financieel overzicht" className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Financieel</h2>
          <p className="mt-1 text-[13px] text-neutral-600">Cashflow en openstaande posten — geen boekhouding.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px]">
          <Link href="/admin/invoices" className="font-medium text-neutral-900 underline underline-offset-2">
            Facturen
          </Link>
          <Link href="/admin/quotes" className="font-medium text-neutral-900 underline underline-offset-2">
            Offertes
          </Link>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Omzet deze maand</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950">{formatCurrencyEUR(revenueThisMonth)}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">{getInvoiceStatusLabel("paid")} (deze periode)</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Openstaand</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950">{formatCurrencyEUR(outstanding)}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">Nog te ontvangen</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Achterstallig</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-900">{overdueCount}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">Vervaldatum verstreken, nog niet betaald</p>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">Offertes open</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-950">{openQuotesCount}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">Concept of verzonden</p>
        </div>
      </div>
    </section>
  );
}
