import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusSelect } from "@/components/admin/billing/quote-status-select";
import {
  formatCurrencyEUR,
  getQuoteStatusLabel,
  parseInvoiceAmount,
  type QuoteStatus,
} from "@/lib/commercial/billing-helpers";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listQuotes } from "@/lib/data/list-quotes";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Offertes" };
  return { title: `Offertes — ${row.name}` };
}

export default async function ClientQuotesPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const quotes = await listQuotes({ clientId: row.id });
  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;
  const newHref = `/admin/quotes/new?client_id=${encodeURIComponent(row.id)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Offertes</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Gekoppeld aan deze klant.</p>
        </div>
        <Link
          href={newHref}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Nieuwe offerte
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">Offertenummer</th>
              <th className="px-4 py-3">Bedrag</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Wijzigen</th>
              <th className="px-4 py-3">Geldig tot</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  Nog geen offertes voor deze klant.{" "}
                  <Link href={newHref} className="font-medium text-blue-700 underline dark:text-blue-400">
                    Maak een offerte
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              quotes.map((r) => (
                <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{r.quote_number}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrencyEUR(parseInvoiceAmount(r.amount))}</td>
                  <td className="px-4 py-3">{getQuoteStatusLabel(r.status as QuoteStatus)}</td>
                  <td className="px-4 py-3">
                    <QuoteStatusSelect quoteId={r.id} initialStatus={r.status as QuoteStatus} />
                  </td>
                  <td className="px-4 py-3">{new Date(r.valid_until).toLocaleDateString("nl-NL")}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/quotes/${r.id}`}
                      className="text-sm font-medium text-blue-800 underline dark:text-blue-400"
                    >
                      Bekijken
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-zinc-500">
        <Link href={`${base}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
          ← Terug naar overzicht
        </Link>
      </p>
    </div>
  );
}
