import type { Metadata } from "next";
import Link from "next/link";
import { searchAdminClients } from "@/lib/data/admin-search-clients";

export const metadata: Metadata = {
  title: "Zoeken",
};

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function AdminSearchPage({ searchParams }: PageProps) {
  const { q: raw } = await searchParams;
  const q = (raw ?? "").trim();
  const results = q.length >= 2 ? await searchAdminClients(q, 50) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Zoeken</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Zoek op klantnaam of URL-slug. Gebruik de balk bovenaan of ga terug naar{" "}
          <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
            Klanten
          </Link>
          .
        </p>
      </div>

      {q.length < 2 ? (
        <p className="text-sm text-zinc-500">Typ minstens 2 tekens in het zoekveld hierboven.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Geen resultaten voor “{q}”.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {results.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/clients/${encodeURIComponent(h.subfolder_slug)}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{h.name}</span>
                <span className="font-mono text-sm text-zinc-500">{h.subfolder_slug}</span>
                <span className="text-xs text-zinc-400">{h.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
