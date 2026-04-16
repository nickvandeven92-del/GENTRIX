"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { DeleteClientButton } from "@/components/admin/delete-client-button";
import { Download, FileText, FolderOpen, SquareUserRound, Trash2 } from "lucide-react";
import {
  PAYMENT_STATUS_LABELS,
  PIPELINE_STAGE_LABELS,
  PLAN_TYPE_LABELS,
  type PaymentStatus,
  type PipelineStage,
  type PlanType,
} from "@/lib/commercial/client-commercial";
import type { ClientFinancialBadge } from "@/lib/data/client-financial-summary";
import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import { formatCurrencyEUR } from "@/lib/commercial/billing-helpers";
import { STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { cn } from "@/lib/utils";

type Row = AdminClientRow & { client_number?: string | null };

type Props = {
  rows: Row[];
  badgeMap: Record<string, ClientFinancialBadge>;
  exportHref: string;
  searchQuery: string;
  /** `?archief=1`: alleen rijen met status gearchiveerd. */
  archiveTabActive?: boolean;
};

function clientsListHref(searchQuery: string, archief: boolean): string {
  const p = new URLSearchParams();
  const q = searchQuery.trim();
  if (q) p.set("q", q);
  if (archief) p.set("archief", "1");
  const s = p.toString();
  return s ? `/admin/clients?${s}` : "/admin/clients";
}

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

type UnlinkBulkJson = {
  ok?: boolean;
  error?: string;
  failures?: { subfolder_slug: string; error: string }[];
};

async function postBulkUnlinkCommercial(subfolder_slugs: string[]): Promise<UnlinkBulkJson> {
  const res = await fetch("/api/admin/clients/unlink-commercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subfolder_slugs }),
  });
  return (await res.json()) as UnlinkBulkJson;
}

export function AdminClientsTableWithBulk({
  rows,
  badgeMap,
  exportHref,
  searchQuery,
  archiveTabActive = false,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const selectableSlugs = useMemo(
    () => rows.map((r) => r.subfolder_slug).filter((s) => s !== STUDIO_HOMEPAGE_SUBFOLDER_SLUG),
    [rows],
  );

  const selectedInView = useMemo(
    () => selectableSlugs.filter((s) => selected.has(s)),
    [selectableSlugs, selected],
  );

  const allSelected = selectableSlugs.length > 0 && selectedInView.length === selectableSlugs.length;
  const someSelected = selectedInView.length > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (selectableSlugs.length === 0) return new Set();
      const next = new Set(prev);
      if (selectableSlugs.every((s) => next.has(s))) {
        for (const s of selectableSlugs) next.delete(s);
      } else {
        for (const s of selectableSlugs) next.add(s);
      }
      return next;
    });
  }, [selectableSlugs]);

  const toggleOne = useCallback((slug: string) => {
    if (slug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  async function onBulkUnlink() {
    if (selectedInView.length === 0) return;
    const names = rows
      .filter((r) => selectedInView.includes(r.subfolder_slug))
      .map((r) => `• ${r.name} (${r.subfolder_slug})`)
      .slice(0, 12);
    const more = selectedInView.length > 12 ? `\n… en ${selectedInView.length - 12} andere` : "";
    const msg = [
      `${selectedInView.length} klantdossier(s) loskoppelen?`,
      "",
      "De website (slug, inhoud, snapshots) blijft bestaan onder Sites.",
      "Facturen, offertes, boekingen, portaal en dossiernotities bij deze dossiers worden gewist.",
      "",
      ...names,
      more,
    ].join("\n");
    if (!window.confirm(msg)) return;

    setBulkLoading(true);
    try {
      const json = await postBulkUnlinkCommercial(selectedInView);
      if (!json.ok) {
        const f = json.failures?.map((x) => `${x.subfolder_slug}: ${x.error}`).join("\n");
        window.alert(f ?? json.error ?? "Bulk loskoppelen mislukt.");
        return;
      }
      clearSelection();
      router.refresh();
    } catch {
      window.alert("Netwerkfout bij bulk loskoppelen.");
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="min-w-0 w-full">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Klanten</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Centraal dossier per klant: facturen, offertes, deals en websites. Verwijderen hier koppelt alleen het dossier los — de site blijft onder{" "}
            <Link href="/admin/sites" className="font-medium text-blue-800 underline dark:text-blue-400">
              Sites
            </Link>{" "}
            bestaan tot je die definitief wist. Afgeronde dossiers kun je op status Archief zetten; die staan onder het tabblad Archief en verdwijnen niet.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            <Download className="size-4" aria-hidden />
            Export CSV
          </a>
          <span className="max-w-[14rem] text-right text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
            Export bevat alle dossiers, ook archief.
          </span>
        </div>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Weergave klantenlijst">
        <Link
          href={clientsListHref(searchQuery, false)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            !archiveTabActive
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/80",
          )}
        >
          Actief &amp; concept
        </Link>
        <Link
          href={clientsListHref(searchQuery, true)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            archiveTabActive
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900/80",
          )}
        >
          Archief
        </Link>
      </nav>

      <form
        method="get"
        action="/admin/clients"
        className="flex max-w-2xl flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        {archiveTabActive ? <input type="hidden" name="archief" value="1" /> : null}
        <div className="min-w-[200px] flex-1">
          <label htmlFor="client-q" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Zoeken
          </label>
          <input
            id="client-q"
            name="q"
            type="search"
            defaultValue={searchQuery}
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

      {selectedInView.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-900/50 dark:bg-red-950/30">
          <span className="font-medium text-red-950 dark:text-red-100">{selectedInView.length} geselecteerd</span>
          <button
            type="button"
            onClick={() => void onBulkUnlink()}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {bulkLoading ? "Bezig…" : "Dossiers loskoppelen"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-medium text-red-900/80 underline dark:text-red-200/90"
          >
            Wis selectie
          </button>
        </div>
      ) : null}

      <div className="sales-os-scroll-x -mx-5 mt-6 min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:-mx-8 lg:-mx-10">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="w-10 px-2 py-3">
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-300"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  disabled={selectableSlugs.length === 0}
                  title="Selecteer alle zichtbare rijen"
                  aria-label="Selecteer alle zichtbare rijen"
                />
              </th>
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
                <td colSpan={12} className="px-4 py-12 text-center text-zinc-500">
                  {archiveTabActive ? (
                    <>
                      Geen klanten met status Archief. Zet een dossier op Archief via de site-editor of het klantdossier,
                      of wissel naar het tabblad Actief &amp; concept.
                    </>
                  ) : (
                    <>
                      Geen klanten in deze weergave (concept, actief of gepauzeerd). Alles staat in het archief? Open het
                      tabblad Archief. Nieuwe klant: via je gebruikelijke aanmaakflow of import.
                    </>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isHome = r.subfolder_slug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
                return (
                  <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                    <td className="px-2 py-3 align-middle">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-zinc-300"
                        checked={selected.has(r.subfolder_slug)}
                        onChange={() => toggleOne(r.subfolder_slug)}
                        disabled={isHome}
                        title={isHome ? "Studio-homepage kan niet bulk-verwijderd worden." : undefined}
                        aria-label={`Selecteer ${r.name}`}
                      />
                    </td>
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
                        {(badgeMap[r.id]?.outstandingAmount ?? 0) <= 0 && (badgeMap[r.id]?.openQuotesCount ?? 0) <= 0 ? (
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
                        <DeleteClientButton
                          subfolderSlug={r.subfolder_slug}
                          clientName={r.name}
                          onSuccess={clearSelection}
                        />
                      </div>
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
