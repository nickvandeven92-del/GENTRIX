import type { Metadata } from "next";
import Link from "next/link";
import { AdminSitesTable } from "@/components/admin/sites-table";
import { resolveSiteOpenAbsoluteUrlForAdmin } from "@/lib/data/client-preview-urls";
import { listAdminClients, type AdminClientRow } from "@/lib/data/list-admin-clients";
import { getRequestOrigin } from "@/lib/site/request-origin";

export const metadata: Metadata = {
  title: "Sites",
};

type SitesPageProps = { searchParams: Promise<{ archief?: string }> };

export default async function AdminSitesPage({ searchParams }: SitesPageProps) {
  const sp = await searchParams;
  const archiveTab = sp.archief === "1" || sp.archief === "true";
  const origin = await getRequestOrigin();
  const baseRows = await listAdminClients({
    includeOrphanWebsites: true,
    statusScope: archiveTab ? "archived_only" : "active_workspace",
  });
  const rows: AdminClientRow[] = await Promise.all(
    baseRows.map(async (r) => ({
      ...r,
      siteOpenAbsoluteUrl: await resolveSiteOpenAbsoluteUrlForAdmin(r.subfolder_slug, r.status, origin),
    })),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Sites</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Snel naar de HTML-editor of de site in een <strong className="font-medium text-zinc-800 dark:text-zinc-200">nieuw tabblad</strong>{" "}
          (<code className="rounded bg-zinc-100 px-1 font-mono text-[11px] dark:bg-zinc-800">/site/…</code>
          , concept met token waar van toepassing). Onder{" "}
          <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
            Klanten
          </Link>{" "}
          kun je een dossier loskoppelen (site blijft hier zichtbaar). Afgeronde sites kun je op status <strong className="font-medium text-zinc-800 dark:text-zinc-200">Archief</strong>{" "}
          zetten; die verschijnen standaard niet in dit overzicht maar blijven onder het tabblad Archief bereikbaar. Met{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">Def. wissen</strong> of bulk hieronder verwijder je de hele tenant uit de database.
        </p>
      </div>

      <AdminSitesTable rows={rows} archiveTabActive={archiveTab} />
    </div>
  );
}
