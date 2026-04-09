"use client";

import { Code2, ExternalLink, FolderOpen } from "lucide-react";
import { PromoVideoDownloadButton } from "@/components/admin/promo-video-download-button";
import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import { cn } from "@/lib/utils";

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Live";
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

export function AdminSitesTable({ rows }: { rows: AdminClientRow[] }) {
  return (
    <div className="sales-os-sites-table overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <table className="w-full text-left text-sm">
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
                <a href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
                  klant
                </a>{" "}
                toe.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="text-zinc-800 dark:text-zinc-200">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{r.subfolder_slug}</td>
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
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    <a
                      href={`/admin/clients/${encodeURIComponent(r.subfolder_slug)}`}
                      data-tone="violet"
                      className="sales-os-table-action inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100"
                    >
                      <FolderOpen className="size-3.5" aria-hidden />
                      Dossier
                    </a>
                    <a
                      href={`/admin/editor/${encodeURIComponent(r.subfolder_slug)}`}
                      data-tone="blue"
                      className="sales-os-table-action inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100"
                    >
                      <Code2 className="size-3.5" aria-hidden />
                      Editor
                    </a>
                    <a
                      href={`/site/${r.subfolder_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-tone="neutral"
                      className="sales-os-table-action inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium dark:border-zinc-700"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Live
                    </a>
                    <PromoVideoDownloadButton
                      variant="compact"
                      buttonClassName="sales-os-table-action"
                      buttonTone="pink"
                      subfolderSlug={r.subfolder_slug}
                      fileBase={
                        r.subfolder_slug.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "") || "site"
                      }
                      disabled={r.status !== "active"}
                      disabledReason="Alleen bij status Live (actieve publieke site)."
                    />
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
