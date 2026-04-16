"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Code2, ExternalLink, FolderOpen, Trash2 } from "lucide-react";
import { PromoVideoDownloadButton } from "@/components/admin/promo-video-download-button";
import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import { STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { cn } from "@/lib/utils";

function siteViewHref(row: AdminClientRow): string {
  if (row.siteOpenAbsoluteUrl && row.siteOpenAbsoluteUrl.trim() !== "") {
    return row.siteOpenAbsoluteUrl.trim();
  }
  const enc = encodeURIComponent(row.subfolder_slug);
  return `/site/${enc}`;
}

function sitesListHref(archief: boolean): string {
  return archief ? "/admin/sites?archief=1" : "/admin/sites";
}

function emptyListHint(archiveTabActive: boolean) {
  if (archiveTabActive) {
    return (
      <>
        Geen sites met status Archief. Zet status op Archief in de site-editor of via het klantdossier, of wissel naar
        Actief &amp; concept.
      </>
    );
  }
  return (
    <>
      Geen sites in deze weergave (concept, actief of gepauzeerd). Afgeronde projecten kun je archiveren; die vind je
      onder het tabblad Archief. Nieuwe site via{" "}
      <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
        Klanten
      </Link>
      .
    </>
  );
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

const cardActionClass =
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium";

const tableActionClass =
  "sales-os-table-action inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "active"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function OrphanPill({ row }: { row: AdminClientRow }) {
  if (!row.commercial_unlinked_at) return null;
  return (
    <span
      className="inline-flex shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
      title="Geen actief commercieel dossier; site blijft bestaan."
    >
      Los dossier
    </span>
  );
}

function PurgeSiteButton({
  subfolderSlug,
  label,
  className,
}: {
  subfolderSlug: string;
  label: string;
  className: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isHome = subfolderSlug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;

  async function run() {
    if (isHome) return;
    if (
      !window.confirm(
        `Site “${label}” (${subfolderSlug}) volledig uit de database verwijderen?\n\n` +
          `Inclusief inhoud, snapshots en alle gekoppelde rijen (cascade). Dit is definitief.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        window.alert(json.error ?? "Verwijderen mislukt.");
        return;
      }
      router.refresh();
    } catch {
      window.alert("Netwerkfout bij verwijderen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading || isHome}
      title={isHome ? "Studio-homepage kan niet worden verwijderd." : "Volledig uit database wissen"}
      onClick={() => void run()}
      className={className}
    >
      <Trash2 className="size-3.5 shrink-0" aria-hidden />
      {loading ? "…" : "Def. wissen"}
    </button>
  );
}

function SiteRowActionsCard({ r }: { r: AdminClientRow }) {
  const slug = encodeURIComponent(r.subfolder_slug);
  const fileBase = r.subfolder_slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "") || "site";

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Link
        href={`/admin/clients/${slug}`}
        data-tone="violet"
        className={cn(
          cardActionClass,
          "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100",
        )}
      >
        <FolderOpen className="size-3.5 shrink-0" aria-hidden />
        Dossier
      </Link>
      <Link
        href={`/admin/ops/studio?slug=${encodeURIComponent(slug)}`}
        data-tone="blue"
        className={cn(
          cardActionClass,
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100",
        )}
      >
        <Code2 className="size-3.5 shrink-0" aria-hidden />
        Editor
      </Link>
      <a
        href={siteViewHref(r)}
        target="_blank"
        rel="noopener noreferrer"
        title={
          r.status === "active"
            ? "Publieke site in nieuw tabblad (/site/…)"
            : r.siteOpenAbsoluteUrl?.includes("token=")
              ? "Concept-site in nieuw tabblad (/site/… met token)"
              : "Site in nieuw tabblad (/site/…); bij concept zonder token: zet preview_secret of open via dossier"
        }
        data-tone="neutral"
        className={cn(cardActionClass, "border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200")}
      >
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
        Site
      </a>
      {/* Promo compact gebruikt max-w op de wrapper; voor kaarten volle celbreedte */}
      <div className="w-full min-w-0 [&>div]:max-w-none">
        <PromoVideoDownloadButton
          variant="compact"
          buttonClassName={cn(cardActionClass, "justify-center")}
          buttonTone="pink"
          subfolderSlug={r.subfolder_slug}
          fileBase={fileBase}
          disabled={r.status !== "active"}
          disabledReason="Alleen bij status Actief (publieke site)."
        />
      </div>
      <PurgeSiteButton
        subfolderSlug={r.subfolder_slug}
        label={r.name}
        className={cn(
          cardActionClass,
          "justify-center border-red-200 text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40",
        )}
      />
    </div>
  );
}

function SiteRowActionsTable({ r }: { r: AdminClientRow }) {
  const slug = encodeURIComponent(r.subfolder_slug);
  const fileBase = r.subfolder_slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "") || "site";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Link
        href={`/admin/clients/${slug}`}
        data-tone="violet"
        className={cn(
          tableActionClass,
          "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100",
        )}
      >
        <FolderOpen className="size-3.5" aria-hidden />
        Dossier
      </Link>
      <Link
        href={`/admin/ops/studio?slug=${encodeURIComponent(slug)}`}
        data-tone="blue"
        className={cn(
          tableActionClass,
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100",
        )}
      >
        <Code2 className="size-3.5" aria-hidden />
        Editor
      </Link>
      <a
        href={siteViewHref(r)}
        target="_blank"
        rel="noopener noreferrer"
        title={
          r.status === "active"
            ? "Publieke site in nieuw tabblad (/site/…)"
            : r.siteOpenAbsoluteUrl?.includes("token=")
              ? "Concept-site in nieuw tabblad (/site/… met token)"
              : "Site in nieuw tabblad (/site/…); bij concept zonder token: zet preview_secret of open via dossier"
        }
        data-tone="neutral"
        className={cn(tableActionClass, "border-zinc-200 dark:border-zinc-700")}
      >
        <ExternalLink className="size-3.5" aria-hidden />
        Site
      </a>
      <PromoVideoDownloadButton
        variant="compact"
        buttonClassName="sales-os-table-action"
        buttonTone="pink"
        subfolderSlug={r.subfolder_slug}
        fileBase={fileBase}
        disabled={r.status !== "active"}
        disabledReason="Alleen bij status Actief (publieke site)."
      />
      <PurgeSiteButton
        subfolderSlug={r.subfolder_slug}
        label={r.name}
        className={cn(
          tableActionClass,
          "border-red-200 text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40",
        )}
      />
    </div>
  );
}

function SiteCard({
  r,
  checked,
  onToggle,
}: {
  r: AdminClientRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const isHome = r.subfolder_slug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 rounded border-zinc-300"
            checked={checked}
            onChange={onToggle}
            disabled={isHome}
            title={isHome ? "Studio-homepage kan niet bulk-verwijderd worden." : undefined}
            aria-label={`Selecteer ${r.name}`}
          />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.name}</p>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">{r.subfolder_slug}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={r.status} />
          <OrphanPill row={r} />
        </div>
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <SiteRowActionsCard r={r} />
      </div>
    </article>
  );
}

async function postBulkDelete(subfolder_slugs: string[]): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/clients/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subfolder_slugs }),
  });
  return (await res.json()) as { ok: boolean; error?: string };
}

export function AdminSitesTable({
  rows,
  archiveTabActive = false,
}: {
  rows: AdminClientRow[];
  /** `?archief=1` op /admin/sites */
  archiveTabActive?: boolean;
}) {
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

  async function onBulkDelete() {
    if (selectedInView.length === 0) return;
    const names = rows
      .filter((r) => selectedInView.includes(r.subfolder_slug))
      .map((r) => `• ${r.name} (${r.subfolder_slug})`)
      .slice(0, 12);
    const more = selectedInView.length > 12 ? `\n… en ${selectedInView.length - 12} andere` : "";
    const msg = [
      `${selectedInView.length} site(s) volledig uit de database verwijderen?`,
      "",
      "Dit wist de tenant inclusief inhoud, snapshots en alle gekoppelde rijen (cascade).",
      "Loskoppelen van alleen het dossier doe je onder Klanten.",
      "",
      ...names,
      more,
    ].join("\n");
    if (!window.confirm(msg)) return;

    setBulkLoading(true);
    try {
      const json = await postBulkDelete(selectedInView);
      if (!json.ok) {
        window.alert(json.error ?? "Bulk verwijderen mislukt.");
        return;
      }
      clearSelection();
      router.refresh();
    } catch {
      window.alert("Netwerkfout bij bulk verwijderen.");
    } finally {
      setBulkLoading(false);
    }
  }

  const empty = (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      {emptyListHint(archiveTabActive)}
    </p>
  );

  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Weergave sites">
        <Link
          href={sitesListHref(false)}
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
          href={sitesListHref(true)}
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

      {selectedInView.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm dark:border-red-900/50 dark:bg-red-950/30">
          <span className="font-medium text-red-950 dark:text-red-100">{selectedInView.length} geselecteerd</span>
          <button
            type="button"
            onClick={() => void onBulkDelete()}
            disabled={bulkLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {bulkLoading ? "Bezig…" : "Verwijder geselecteerde sites"}
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

      {/* Mobiel: kaarten i.p.v. tabel zodat acties leesbaar en tikbaar blijven */}
      <div className="min-w-0 space-y-3 md:hidden">
        {rows.length === 0 ? (
          empty
        ) : (
          rows.map((r) => (
            <SiteCard
              key={r.id}
              r={r}
              checked={selected.has(r.subfolder_slug)}
              onToggle={() => toggleOne(r.subfolder_slug)}
            />
          ))
        )}
      </div>

      <div className="sales-os-sites-table hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
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
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  {emptyListHint(archiveTabActive)}
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
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.subfolder_slug}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={r.status} />
                        <OrphanPill row={r} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SiteRowActionsTable r={r} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
