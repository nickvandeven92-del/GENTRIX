import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText, FolderOpen, SquareUserRound } from "lucide-react";
import { DeleteClientButton } from "@/components/admin/delete-client-button";
import {
  PAYMENT_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  PLAN_TYPE_LABELS,
  type PaymentStatus,
  type PipelineStage,
  type PlanType,
} from "@/lib/commercial/client-commercial";
import { formatCurrencyEUR } from "@/lib/commercial/billing-helpers";
import { getClientsFinancialBadgesMap } from "@/lib/data/client-financial-summary";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Klanten",
};

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Actief";
    case "draft":
      return "Concept";
    case "paused":
      return "Gepauzeerd";
    case "archived":
      return "Archief";
    default:
      return status;
  }
}

type ClientsPageProps = { searchParams: Promise<{ q?: string }> };

export default async function AdminClientsPage({ searchParams }: ClientsPageProps) {
  const sp = await searchParams;
  const rows = await listAdminClients({ search: sp.q });
  const badgeMap = await getClientsFinancialBadgesMap(rows.map((r) => r.id));

  return (
    <div className="min-w-0 w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Klanten</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Centraal dossier per klant: facturen, offertes, deals en websites. Open een rij om het volledige overzicht te zien.
          </p>
        </div>
        <a
          href="/api/admin/clients-export"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          <Download className="size-4" aria-hidden />
          Export CSV
        </a>
      </div>

      <form
        method="get"
        action="/admin/clients"
        className="flex max-w-2xl flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="min-w-[200px] flex-1">
          <label htmlFor="client-q" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Zoeken
          </label>
          <input
            id="client-q"
            name="q"
            type="search"
            defaultValue={sp.q ?? ""}
            placeholder="Naam of klantnummer…"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Zoeken
        </button>
      </form>

      <div className="sales-os-scroll-x -mx-5 min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:-mx-8 lg:-mx-10">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Klantnummer</th>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Signalen</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Betaling</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Domein</th>
              <th className="px-4 py-3">Bijgewerkt</th>
              <th className="px-4 py-3 text-right whitespace-nowrap">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-zinc-500">
                  Nog geen klanten. Voeg een klant toe via je gebruikelijke aanmaakflow of import.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {r.client_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(badgeMap[r.id]?.outstandingAmount ?? 0) > 0 ? (
                        <span
                          className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-900 dark:bg-red-950/60 dark:text-red-200"
                          title="Openstaande facturen (concept + verzonden)"
                        >
                          {formatCurrencyEUR(badgeMap[r.id]!.outstandingAmount)}
                        </span>
                      ) : null}
                      {(badgeMap[r.id]?.openQuotesCount ?? 0) > 0 ? (
                        <span
                          className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-900 dark:bg-orange-950/60 dark:text-orange-200"
                          title="Open offertes"
                        >
                          {badgeMap[r.id]!.openQuotesCount} offerte
                          {badgeMap[r.id]!.openQuotesCount === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {(badgeMap[r.id]?.outstandingAmount ?? 0) <= 0 &&
                      (badgeMap[r.id]?.openQuotesCount ?? 0) <= 0 ? (
                        <span className="text-xs text-zinc-400">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.subfolder_slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        r.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
                      )}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.plan_type && r.plan_type in PLAN_TYPE_LABELS
                      ? PLAN_TYPE_LABELS[r.plan_type as PlanType]
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.payment_status in PAYMENT_STATUS_LABELS
                      ? PAYMENT_STATUS_LABELS[r.payment_status as PaymentStatus]
                      : r.payment_status}
                  </td>
                  <td className="max-w-[100px] truncate px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {r.pipeline_stage in PIPELINE_STAGE_LABELS
                      ? PIPELINE_STAGE_LABELS[r.pipeline_stage as PipelineStage]
                      : r.pipeline_stage}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {r.custom_domain ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {new Date(r.updated_at).toLocaleString("nl-NL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-[9.5rem] flex-col items-end gap-1.5 sm:min-w-0 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
                      <Link
                        href={`/admin/clients/${encodeURIComponent(r.subfolder_slug)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/60"
                      >
                        <FolderOpen className="size-3.5" aria-hidden />
                        Dossier
                      </Link>
                      <Link
                        href={`/admin/clients/${encodeURIComponent(r.subfolder_slug)}/commercial`}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-300/80 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-100 dark:hover:bg-violet-950/40"
                      >
                        <FileText className="size-3.5" aria-hidden />
                        Commercie
                      </Link>
                      {r.status === "active" ? (
                        <Link
                          href={`/portal/${encodeURIComponent(r.subfolder_slug)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60"
                        >
                          <SquareUserRound className="size-3.5" aria-hidden />
                          Portaal
                        </Link>
                      ) : null}
                      <DeleteClientButton subfolderSlug={r.subfolder_slug} clientName={r.name} />
                    </div>
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
