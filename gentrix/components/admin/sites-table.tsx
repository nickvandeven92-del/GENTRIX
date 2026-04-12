"use client";

import Link from "next/link";
import { Code2, ExternalLink, FolderOpen } from "lucide-react";
import { PromoVideoDownloadButton } from "@/components/admin/promo-video-download-button";
import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import { cn } from "@/lib/utils";

function siteViewHref(row: AdminClientRow): string {
  if (row.siteOpenAbsoluteUrl && row.siteOpenAbsoluteUrl.trim() !== "") {
    return row.siteOpenAbsoluteUrl.trim();
  }
  const enc = encodeURIComponent(row.subfolder_slug);
  if (row.status === "active") {
    return `/site/${enc}`;
  }
  return `/admin/clients/${enc}/preview`;
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
            ? "Publieke site (/site/…), volledig scherm"
            : r.siteOpenAbsoluteUrl?.includes("token=")
              ? "Concept in volledige weergave (/site met token); zonder Studio-zijbalk"
              : "Concept in admin-preview (Studio-zijbalk); stel preview_secret in of activeer voor volledig scherm"
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
            ? "Publieke site (/site/…), volledig scherm"
            : r.siteOpenAbsoluteUrl?.includes("token=")
              ? "Concept in volledige weergave (/site met token); zonder Studio-zijbalk"
              : "Concept in admin-preview (Studio-zijbalk); stel preview_secret in of activeer voor volledig scherm"
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
    </div>
  );
}

function SiteCard({ r }: { r: AdminClientRow }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{r.name}</p>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{r.subfolder_slug}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <SiteRowActionsCard r={r} />
      </div>
    </article>
  );
}

export function AdminSitesTable({ rows }: { rows: AdminClientRow[] }) {
  const empty = (
    <p className="rounded-xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
      Nog geen klanten. Voeg eerst een{" "}
      <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
        klant
      </Link>{" "}
      toe.
    </p>
  );

  return (
    <>
      {/* Mobiel: kaarten i.p.v. tabel zodat acties leesbaar en tikbaar blijven */}
      <div className="min-w-0 space-y-3 md:hidden">
        {rows.length === 0 ? empty : rows.map((r) => <SiteCard key={r.id} r={r} />)}
      </div>

      <div className="sales-os-sites-table hidden min-w-0 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Klant</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                  Nog geen klanten. Voeg eerst een{" "}
                  <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
                    klant
                  </Link>{" "}
                  toe.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.subfolder_slug}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <SiteRowActionsTable r={r} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
