import type { Metadata } from "next";
import { OpsCockpitHero } from "@/components/sales-os/overview/ops-cockpit-hero";
import { PriorityRail } from "@/components/sales-os/overview/priority-rail";
import { OpsOpenTasks } from "@/components/sales-os/overview/ops-open-tasks";
import { RevenueSnapshot } from "@/components/sales-os/overview/revenue-snapshot";
import { PipelineSection } from "@/components/sales-os/overview/pipeline-section";
import { ClientHealthBoard } from "@/components/sales-os/overview/client-health-board";
import { WebsiteProductionBoard } from "@/components/sales-os/overview/website-production-board";
import { listAdminClients } from "@/lib/data/list-admin-clients";
import { listSalesDeals } from "@/lib/data/sales-deals";
import { listSalesTasks } from "@/lib/data/sales-tasks";
import { listSalesLeads } from "@/lib/data/sales-leads";
import { listWebsiteOpsWithClients } from "@/lib/data/website-ops";
import { buildClientHealthRows } from "@/lib/sales-os/build-client-health-rows";
import { buildAssistantBriefing } from "@/lib/sales-os/assistant-briefing";
import { buildOpsPrioritySignals, buildRevenueSnapshotMetrics } from "@/lib/sales-os/signals";
import { DEAL_STAGE_LABELS, isClosedDealStage } from "@/lib/sales-os/deal-stages";
import { OpsAssistantBriefing } from "@/components/sales-os/overview/ops-assistant-briefing";
import { buildPipelineDealAssistContext } from "@/lib/sales-os/pipeline-deal-assist";
import { effectiveDealNextStepMessage, openDealsForFollowUpList } from "@/lib/sales-os/deal-step-log";
import { OpsDealFollowUps } from "@/components/sales-os/overview/ops-deal-follow-ups";
import { OpsBillingMetrics } from "@/components/sales-os/overview/ops-billing-metrics";
import {
  countOpenQuotes,
  listQuotesExpiringWithinDays,
} from "@/lib/data/list-quotes";
import {
  countOverdueInvoices,
  getOutstandingAmount,
  getRevenueThisMonth,
  listInvoicesDueWithinDays,
  listRecentlySentInvoices,
} from "@/lib/data/list-invoices";
import { OpsBillingCashflowLists } from "@/components/sales-os/overview/ops-billing-cashflow-lists";

export const metadata: Metadata = {
  title: "Sales OS",
};

export default async function SalesOpsOverviewPage() {
  const [
    clients,
    deals,
    allTasks,
    leads,
    websiteOps,
    revenueThisMonth,
    outstanding,
    overdueCount,
    openQuotesCount,
    recentSentInvoices,
    invoicesDueSoon,
    quotesExpiringSoon,
  ] = await Promise.all([
    listAdminClients(),
    listSalesDeals(),
    listSalesTasks(),
    listSalesLeads(),
    listWebsiteOpsWithClients(),
    getRevenueThisMonth(),
    getOutstandingAmount(),
    countOverdueInvoices(),
    countOpenQuotes(),
    listRecentlySentInvoices(5),
    listInvoicesDueWithinDays(14, 8),
    listQuotesExpiringWithinDays(14, 8),
  ]);

  const openTasksAll = allTasks.filter((t) => t.status === "open");
  const openTasks = openTasksAll.slice(0, 12);

  const openTaskCountByClientId = new Map<string, number>();
  for (const t of openTasksAll) {
    if (t.linked_entity_type !== "client") continue;
    const id = t.linked_entity_id;
    openTaskCountByClientId.set(id, (openTaskCountByClientId.get(id) ?? 0) + 1);
  }

  const dealFocusByClientId = new Map<string, string>();
  for (const d of deals) {
    if (!d.client_id || isClosedDealStage(d.stage)) continue;
    if (dealFocusByClientId.has(d.client_id)) continue;
    const trimmed = effectiveDealNextStepMessage(d)?.trim();
    const hint = trimmed
      ? trimmed.length > 72
        ? `${trimmed.slice(0, 72)}…`
        : trimmed
      : DEAL_STAGE_LABELS[d.stage];
    dealFocusByClientId.set(d.client_id, hint);
  }

  const opsByClient = new Map(websiteOps.map((o) => [o.client_id, o]));
  const healthRows = buildClientHealthRows(clients, opsByClient, {
    openTaskCountByClientId,
    dealFocusByClientId,
  });
  const priority = buildOpsPrioritySignals({ clients, deals, websiteOps, leads });
  const revenue = buildRevenueSnapshotMetrics(deals, clients);
  const openTasksCount = openTasksAll.length;
  const briefing = buildAssistantBriefing({
    clients,
    deals,
    websiteOps,
    leads,
    tasks: allTasks,
  });
  const pipelineAssist = buildPipelineDealAssistContext(clients, deals, leads);

  const dealFollowUps = openDealsForFollowUpList(deals);
  const dealFollowUpCount = dealFollowUps.length;
  const dealFollowUpsShown = dealFollowUps.slice(0, 15);

  return (
    <div className="w-full min-w-0 space-y-10 pb-20 md:space-y-12 md:pb-24">
      <OpsCockpitHero
        priorities={priority}
        revenue={revenue}
        openTasksCount={openTasksCount}
        dealFollowUpCount={dealFollowUpCount}
      />

      <OpsBillingMetrics
        revenueThisMonth={revenueThisMonth}
        outstanding={outstanding}
        overdueCount={overdueCount}
        openQuotesCount={openQuotesCount}
      />

      <OpsBillingCashflowLists
        recentSent={recentSentInvoices}
        dueSoon={invoicesDueSoon}
        expiringQuotes={quotesExpiringSoon}
      />

      <OpsAssistantBriefing briefing={briefing} />

      <PriorityRail items={priority} />

      <OpsDealFollowUps rows={dealFollowUpsShown} totalCount={dealFollowUpCount} variant="cockpit" />

      <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <OpsOpenTasks tasks={openTasks} variant="cockpit" />
        </div>
        <div className="lg:col-span-5">
          <RevenueSnapshot metrics={revenue} variant="cockpit" />
        </div>
      </div>

      <PipelineSection deals={deals} assistContext={pipelineAssist} />

      <div className="space-y-16 border-t border-neutral-100 pt-16 dark:border-white/10">
        <ClientHealthBoard rows={healthRows} />
        <WebsiteProductionBoard items={websiteOps} />
      </div>
    </div>
  );
}
