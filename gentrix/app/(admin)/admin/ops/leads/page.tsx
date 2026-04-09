import type { Metadata } from "next";
import { CreateLeadForm } from "@/components/sales-os/leads/create-lead-form";
import { LeadsWorkspace } from "@/components/sales-os/leads/leads-workspace";
import { listSalesLeads } from "@/lib/data/sales-leads";

export const metadata: Metadata = {
  title: "Leads",
};

export default async function SalesOpsLeadsPage() {
  const leads = await listSalesLeads();
  return (
    <div className="w-full min-w-0 space-y-4">
      <CreateLeadForm />
      <LeadsWorkspace leads={leads} />
    </div>
  );
}
