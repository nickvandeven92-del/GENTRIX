import type { Metadata } from "next";
import { AdminSitesTable } from "@/components/admin/sites-table";
import { listAdminClients } from "@/lib/data/list-admin-clients";

export const metadata: Metadata = {
  title: "Sites",
};

export default async function AdminSitesPage() {
  const rows = await listAdminClients();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Sites</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Snel naar de HTML-editor of de site bekijken (live op /site/… of concept in preview). Het volledige dossier
          (commercie, domein) staat onder{" "}
          <a href="/admin/clients" className="font-medium text-blue-800 underline dark:text-blue-400">
            Klanten
          </a>
          .
        </p>
      </div>

      <AdminSitesTable rows={rows} />
    </div>
  );
}
