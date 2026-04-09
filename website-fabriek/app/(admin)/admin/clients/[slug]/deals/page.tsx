import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEAL_STAGE_LABELS } from "@/lib/sales-os/deal-stages";
import type { SalesDealStage } from "@/lib/sales-os/deal-stages";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listSalesDealsForClient } from "@/lib/data/sales-deals";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Deals" };
  return { title: `Deals — ${row.name}` };
}

export default async function ClientDealsPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const deals = await listSalesDealsForClient(row.id);
  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Deals</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Sales-pijplijn gekoppeld aan deze klant.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">Bedrijf</th>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Waarde</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {deals.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  Geen deals gekoppeld. Maak een deal aan in{" "}
                  <Link href="/admin/ops/deals" className="font-medium text-blue-700 underline dark:text-blue-400">
                    het deal-overzicht
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              deals.map((d) => (
                <tr key={d.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-medium">{d.company_name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{d.title || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatEURFromCents(d.value_cents)}</td>
                  <td className="px-4 py-3">{DEAL_STAGE_LABELS[d.stage as SalesDealStage]}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/ops/deals/${d.id}`}
                      className="text-sm font-medium text-blue-800 underline dark:text-blue-400"
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

      <p className="text-sm text-zinc-500">
        <Link href={`${base}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
          ← Terug naar overzicht
        </Link>
      </p>
    </div>
  );
}
