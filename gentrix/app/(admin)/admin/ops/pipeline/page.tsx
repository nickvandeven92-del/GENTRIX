import type { Metadata } from "next";
import { PipelineSection } from "@/components/sales-os/overview/pipeline-section";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { listSalesDeals } from "@/lib/data/sales-deals";
import { listSalesLeads } from "@/lib/data/sales-leads";
import { buildPipelineDealAssistContext } from "@/lib/sales-os/pipeline-deal-assist";

export const metadata: Metadata = {
  title: "Pijplijn",
};

export default async function SalesOpsPipelinePage() {
  const [deals, clients, leads] = await Promise.all([
    listSalesDeals(),
    listAdminClients(),
    listSalesLeads(),
  ]);
  const assistContext = buildPipelineDealAssistContext(clients, deals, leads);
  return (
    <div className="mx-auto max-w-[1400px]">
      <PipelineSection deals={deals} assistContext={assistContext} />
    </div>
  );
}
