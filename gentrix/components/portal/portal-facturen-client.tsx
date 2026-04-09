"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InvoiceWithClient } from "@/lib/data/list-invoices";
import type { InvoiceStoredStatus } from "@/lib/commercial/billing-helpers";
import {
  formatCurrencyEUR,
  formatDocumentDate,
  getInvoiceListStatusLabel,
  parseInvoiceAmount,
} from "@/lib/commercial/billing-helpers";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  invoices: InvoiceWithClient[];
};

const FILTER_ALL = "all" as const;
type Filter = typeof FILTER_ALL | InvoiceStoredStatus;

export function PortalFacturenClient({ slug, invoices }: Props) {
  const enc = encodeURIComponent(slug);
  const [filter, setFilter] = useState<Filter>(FILTER_ALL);

  const filtered = useMemo(() => {
    if (filter === FILTER_ALL) return invoices;
    return invoices.filter((i) => i.status === filter);
  }, [filter, invoices]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Filter:</span>
        {(
          [
            [FILTER_ALL, "Alles"],
            ["sent", "Openstaand"],
            ["paid", "Betaald"],
            ["cancelled", "Geannuleerd"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              filter === value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Geen facturen in deze filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Nummer</th>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Bedrag</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((inv) => (
                <tr key={inv.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-mono text-xs">
                    {inv.invoice_number ?? "—"}
                  </td>
                  <td className="px-4 py-3">{formatDocumentDate(inv.issued_at ?? inv.created_at)}</td>
                  <td className="px-4 py-3">{getInvoiceListStatusLabel(inv)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCurrencyEUR(parseInvoiceAmount(inv.amount))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/portal/${enc}/facturen/${encodeURIComponent(inv.id)}`}
                      className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
