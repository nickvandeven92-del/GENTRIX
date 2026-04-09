import type { Metadata } from "next";
import Link from "next/link";
import { QuoteStatusSelect } from "@/components/admin/billing/quote-status-select";
import {
  formatCurrencyEUR,
  getQuoteStatusLabel,
  parseInvoiceAmount,
  type QuoteStatus,
} from "@/lib/commercial/billing-helpers";
import { listQuotes } from "@/lib/data/list-quotes";

export const metadata: Metadata = {
  title: "Offertes",
};

const QUOTE_STATUSES: QuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

type PageProps = { searchParams: Promise<{ q?: string; status?: string }> };

export default async function AdminQuotesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter = QUOTE_STATUSES.includes(sp.status as QuoteStatus) ? (sp.status as QuoteStatus) : undefined;
  const rows = await listQuotes({ search: sp.q, status: statusFilter });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Offertes</h1>
          <p className="mt-1 text-[13px] text-neutral-500">Documenten en geldigheid tot acceptatie.</p>
        </div>
        <Link
          href="/admin/quotes/new"
          className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Nieuwe offerte
        </Link>
      </div>

      <form
        method="get"
        action="/admin/quotes"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="quote-q" className="text-[11px] font-medium text-neutral-600">
            Zoeken
          </label>
          <input
            id="quote-q"
            name="q"
            type="search"
            defaultValue={sp.q ?? ""}
            placeholder="Offertenummer, klant of klantnummer…"
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="quote-status" className="text-[11px] font-medium text-neutral-600">
            Status
          </label>
          <select
            id="quote-status"
            name="status"
            defaultValue={sp.status ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">Alle statussen</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {getQuoteStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Toepassen
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Offertenummer</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Klantnummer</th>
              <th className="px-4 py-3">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Status wijzigen</th>
              <th className="px-4 py-3">Geldig tot</th>
              <th className="px-4 py-3">Offertedatum</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-500">
                  Geen offertes gevonden.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3 font-mono text-[12px] font-medium text-neutral-900">{r.quote_number}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{r.clients?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-neutral-700">{r.clients?.client_number ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-neutral-800">
                    {formatCurrencyEUR(parseInvoiceAmount(r.amount))}
                  </td>
                  <td className="px-4 py-3 text-neutral-800">{getQuoteStatusLabel(r.status as QuoteStatus)}</td>
                  <td className="px-4 py-3">
                    <QuoteStatusSelect quoteId={r.id} initialStatus={r.status as QuoteStatus} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {new Date(r.valid_until).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {new Date(r.issued_at ?? r.created_at).toLocaleDateString("nl-NL")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      className="text-[12px] font-medium text-neutral-900 underline underline-offset-2"
                    >
                      Openen
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
