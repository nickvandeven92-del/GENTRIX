import type { Metadata } from "next";
import Link from "next/link";
import { listAwaitingSupportReplyRows } from "@/lib/support/admin-support-inbox";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Support-inbox",
};

export default async function SupportInboxPage() {
  const supabase = await createSupabaseServerClient();
  const rows = await listAwaitingSupportReplyRows(supabase, { maxThreads: 300 });

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">Support-inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-zinc-400">
          Open onderwerpen waarbij de klant het laatste bericht stuurde — wachten op een studio-antwoord. Klik door naar
          het dossier om te antwoorden of het onderwerp te sluiten.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Geen openstaande support-berichten.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Klant</th>
                <th className="px-4 py-3">Onderwerp</th>
                <th className="hidden px-4 py-3 sm:table-cell">Laatste activiteit</th>
                <th className="px-4 py-3 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-zinc-800">
              {rows.map((r) => {
                const enc = encodeURIComponent(r.subfolder_slug);
                return (
                  <tr key={r.threadId}>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-700 dark:text-zinc-300">{r.subfolder_slug}</td>
                    <td className="px-4 py-3 text-neutral-900 dark:text-zinc-100">{r.subject}</td>
                    <td className="hidden px-4 py-3 text-neutral-600 dark:text-zinc-400 sm:table-cell">
                      {new Date(r.updated_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/clients/${enc}#client-support-chat`}
                        className="inline-flex rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        Naar dossier
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
