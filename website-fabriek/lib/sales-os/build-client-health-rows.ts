import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import type { WebsiteOpsRow } from "@/lib/data/website-ops";
import { getChurnRiskLevel, getClientHealthScore } from "@/lib/sales-os/scoring";

export type ClientHealthViewRow = {
  id: string;
  name: string;
  plan: string;
  revenue: string;
  websiteStatus: string;
  payment: string;
  health: number;
  churnRisk: ReturnType<typeof getChurnRiskLevel>;
  lastActivity: string;
  slug: string;
  billingEmail: string | null;
  /** Korte assistent-context (site, taken, deal). */
  contextBullets: string[];
};

export type ClientHealthBuildExtras = {
  openTaskCountByClientId: Map<string, number>;
  dealFocusByClientId: Map<string, string>;
};

/** Bouwt rijen voor Sales OS client health uit clients + website_ops_state. */
export function buildClientHealthRows(
  clients: AdminClientRow[],
  opsByClientId: Map<string, WebsiteOpsRow>,
  extras?: ClientHealthBuildExtras,
): ClientHealthViewRow[] {
  return clients.map((c) => {
    const w = opsByClientId.get(c.id);
    const websiteStatus = w?.ops_status ?? "—";
    const openTasks = extras?.openTaskCountByClientId.get(c.id) ?? 0;
    const dealLine = extras?.dealFocusByClientId.get(c.id);
    const rel = formatRelative(c.updated_at);
    const contextBullets: string[] = [
      `Laatst: ${rel}`,
      `Site: ${websiteStatus}`,
      openTasks > 0 ? `${openTasks} open ${openTasks === 1 ? "taak" : "taken"}` : "Geen open taken",
      dealLine ? `Deal: ${dealLine}` : "Geen open deal",
    ];
    return {
      id: c.id,
      name: c.name,
      plan: c.plan_label || c.plan_type || "—",
      revenue: "—",
      websiteStatus,
      payment: c.payment_status,
      health: getClientHealthScore(c),
      churnRisk: getChurnRiskLevel(c),
      lastActivity: formatRelative(c.updated_at),
      slug: c.subfolder_slug,
      billingEmail: c.billing_email ?? null,
      contextBullets,
    };
  });
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
