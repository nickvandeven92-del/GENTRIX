import type { Metadata } from "next";
import Link from "next/link";
import { AdminSitesTable } from "@/components/admin/sites-table";
import { resolveSiteOpenAbsoluteUrlForAdmin } from "@/lib/data/client-preview-urls";
import { listAdminClients, type AdminClientRow } from "@/lib/data/list-admin-clients";
import { getRequestOrigin } from "@/lib/site/request-origin";

export const metadata: Metadata = {
  title: "Sites",
};

export default async function AdminSitesPage() {
  const origin = await getRequestOrigin();
  const baseRows = await listAdminClients();
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
          , concept met token waar van toepassing). Het volledige dossier (commercie, domein) staat onder{" "}
          <Link href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
            Klanten
          </Link>
          .
        </p>
      </div>

      <AdminSitesTable rows={rows} />
    </div>
  );
}
