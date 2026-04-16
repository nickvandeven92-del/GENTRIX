import type { Metadata } from "next";
import { AdminClientsTableWithBulk } from "@/components/admin/admin-clients-table-with-bulk";
import { getClientsFinancialBadgesMap } from "@/lib/data/client-financial-summary";
import { listAdminClients } from "@/lib/data/list-admin-clients";

export const metadata: Metadata = {
  title: "Klanten",
};

type ClientsPageProps = { searchParams: Promise<{ q?: string; archief?: string }> };

export default async function AdminClientsPage({ searchParams }: ClientsPageProps) {
  const sp = await searchParams;
  const archiveTab = sp.archief === "1" || sp.archief === "true";
  const rows = await listAdminClients({
    search: sp.q,
    statusScope: archiveTab ? "archived_only" : "active_workspace",
  });
  const badgeMap = await getClientsFinancialBadgesMap(rows.map((r) => r.id));

  return (
    <AdminClientsTableWithBulk
      rows={rows}
      badgeMap={badgeMap}
      exportHref="/api/admin/clients-export"
      searchQuery={sp.q ?? ""}
      archiveTabActive={archiveTab}
    />
  );
}
