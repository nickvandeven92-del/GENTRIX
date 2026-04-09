import Link from "next/link";
import { formatCurrencyEUR, parseInvoiceAmount } from "@/lib/commercial/billing-helpers";
import type { InvoiceWithClient } from "@/lib/data/list-invoices";
import type { QuoteWithClient } from "@/lib/data/list-quotes";

type Props = {
  recentSent: InvoiceWithClient[];
  dueSoon: InvoiceWithClient[];
  expiringQuotes: QuoteWithClient[];
};

export function OpsBillingCashflowLists({ recentSent, dueSoon, expiringQuotes }: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <section className="rounded-xl border border-neutral-200/80 bg-white p-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Recent verzonden</h3>
        <p className="mt-1 text-[12px] text-neutral-500">Facturen met status Verzonden.</p>
        <ul className="mt-3 space-y-2">
          {recentSent.length === 0 ? (
            <li className="text-[12px] text-neutral-400">—</li>
          ) : (
            recentSent.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                <Link href={`/admin/invoices/${r.id}`} className="min-w-0 font-medium text-neutral-900 hover:underline">
                  <span className="font-mono text-[11px]">{r.invoice_number ?? "Concept"}</span>
                  <span className="mt-0.5 block truncate text-neutral-600">{r.clients?.name ?? "—"}</span>
                </Link>
                <span className="shrink-0 tabular-nums text-neutral-700">
                  {formatCurrencyEUR(parseInvoiceAmount(r.amount))}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/80 bg-white p-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Bijna vervallen</h3>
        <p className="mt-1 text-[12px] text-neutral-500">Openstaand, verval binnen 14 dagen.</p>
        <ul className="mt-3 space-y-2">
          {dueSoon.length === 0 ? (
            <li className="text-[12px] text-neutral-400">—</li>
          ) : (
            dueSoon.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                <Link href={`/admin/invoices/${r.id}`} className="min-w-0 font-medium text-neutral-900 hover:underline">
                  <span className="font-mono text-[11px]">{r.invoice_number ?? "Concept"}</span>
                  <span className="mt-0.5 block text-neutral-500">
                    Vervaldatum {new Date(r.due_date).toLocaleDateString("nl-NL")}
                  </span>
                </Link>
                <span className="shrink-0 tabular-nums text-neutral-700">
                  {formatCurrencyEUR(parseInvoiceAmount(r.amount))}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-neutral-200/80 bg-white p-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Offertes lopen af</h3>
        <p className="mt-1 text-[12px] text-neutral-500">Concept of verzonden, geldig tot binnen 14 dagen.</p>
        <ul className="mt-3 space-y-2">
          {expiringQuotes.length === 0 ? (
            <li className="text-[12px] text-neutral-400">—</li>
          ) : (
            expiringQuotes.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 text-[12px]">
                <Link href={`/admin/quotes/${r.id}`} className="min-w-0 font-medium text-neutral-900 hover:underline">
                  <span className="font-mono text-[11px]">{r.quote_number}</span>
                  <span className="mt-0.5 block text-neutral-500">
                    Geldig tot {new Date(r.valid_until).toLocaleDateString("nl-NL")}
                  </span>
                </Link>
                <span className="shrink-0 tabular-nums text-neutral-700">
                  {formatCurrencyEUR(parseInvoiceAmount(r.amount))}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
