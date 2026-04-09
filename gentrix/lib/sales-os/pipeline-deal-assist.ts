import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import type { SalesLeadRow } from "@/lib/data/sales-leads";

/** Server-side opgebouwd: slugs + lead-mail per deal voor snelle acties op pijplijnkaarten. */
export type PipelineDealAssistContext = {
  clientSlugByClientId: Record<string, string>;
  contactEmailByDealId: Record<string, string>;
};

export function buildPipelineDealAssistContext(
  clients: AdminClientRow[],
  deals: SalesDealRow[],
  leads: SalesLeadRow[],
): PipelineDealAssistContext {
  const clientSlugByClientId = Object.fromEntries(clients.map((c) => [c.id, c.subfolder_slug]));
  const emailByLeadId = new Map<string, string>();
  for (const l of leads) {
    const e = l.email?.trim();
    if (e?.includes("@")) emailByLeadId.set(l.id, e);
  }
  const contactEmailByDealId: Record<string, string> = {};
  for (const d of deals) {
    if (!d.lead_id) continue;
    const em = emailByLeadId.get(d.lead_id);
    if (em) contactEmailByDealId[d.id] = em;
  }
  return { clientSlugByClientId, contactEmailByDealId };
}
