import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, QrCode } from "lucide-react";
import { listAdminClients } from "@/lib/data/list-admin-clients";

export const metadata: Metadata = {
  title: "Flyer & QR",
};

export default async function AdminFlyersHubPage() {
  const rows = await listAdminClients();

  return (
    <div className="min-w-0 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Flyer & QR</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Kies een klant om de vaste flyer-link, QR-preview, PDF-downloads en scanstatistieken te openen. Elke klant heeft één
          stabiele <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">/p/…</code>-link voor drukwerk.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/clients" className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
            ← Alle klanten
          </Link>
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Klant</th>
              <th className="hidden px-4 py-3 sm:table-cell">Slug</th>
              <th className="px-4 py-3 text-right">Actie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                  Geen klanten gevonden.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const enc = encodeURIComponent(r.subfolder_slug);
                return (
                  <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.name}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400 sm:table-cell">
                      {r.subfolder_slug}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clients/${enc}/flyer`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/70"
                      >
                        <QrCode className="size-3.5 shrink-0" aria-hidden />
                        Flyer & QR
                        <ExternalLink className="size-3 opacity-60" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
