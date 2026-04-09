import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import type { SalesLeadRow } from "@/lib/data/sales-leads";
import type { WebsiteOpsWithClient } from "@/lib/data/website-ops";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";
import { effectiveDealFollowUpDueAt, effectiveDealNextStepMessage } from "@/lib/sales-os/deal-step-log";
import { formatEURFromCents } from "@/lib/sales-os/format-money";
import { getChurnRiskLevel } from "@/lib/sales-os/scoring";

export type OpsPrioritySeverity = "critical" | "attention" | "healthy";

/** Eén regel in de priority rail: afgeleid uit data, geen demo-teksten. */
export type OpsPrioritySignal = {
  id: string;
  title: string;
  detail: string;
  severity: OpsPrioritySeverity;
  actionLabel: string;
  href: string;
};

const MS_DAY = 86_400_000;

function renewalWithinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  return t >= now && t <= now + days * MS_DAY;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / MS_DAY);
}

/**
 * Prioriteiten voor het overview: churn, live+zonder paid, deals vast in fase,
 * failed billing, verlopen deal-follow-ups, sites, renewals, leads.
 */
export function buildOpsPrioritySignals(input: {
  clients: AdminClientRow[];
  deals: SalesDealRow[];
  websiteOps: WebsiteOpsWithClient[];
  leads: SalesLeadRow[];
}): OpsPrioritySignal[] {
  const signals: OpsPrioritySignal[] = [];

  const clientById = new Map(input.clients.map((c) => [c.id, c]));

  const highChurnClients = input.clients.filter((c) => getChurnRiskLevel(c) === "high");
  if (highChurnClients.length > 0) {
    const n = highChurnClients.length;
    signals.push({
      id: "churn-high",
      title: "Hoog churn-risico",
      detail: `${n} klant${n === 1 ? "" : "en"} met failed/pending betaling of gepauzeerd — prioriteit in gezondheid.`,
      severity: "critical",
      actionLabel: "Gezondheid",
      href: "/admin/ops#gezondheid",
    });
  }

  const liveNotPaid = input.clients.filter(
    (c) => c.status === "active" && c.payment_status !== "paid",
  );
  if (liveNotPaid.length > 0) {
    signals.push({
      id: "live-unpaid",
      title: "Live site, betaling niet ‘paid’",
      detail: `${liveNotPaid.length} site(s) live (status active) terwijl payment_status geen paid is — check facturatie.`,
      severity: "attention",
      actionLabel: "Klanten",
      href: "/admin/ops/clients",
    });
  }

  const STUCK_STAGE_DAYS = 14;
  const stuckInStage = input.deals.filter((d) => {
    if (isClosedDealStage(d.stage)) return false;
    const t = new Date(d.updated_at).getTime();
    if (Number.isNaN(t)) return false;
    return Date.now() - t > STUCK_STAGE_DAYS * MS_DAY;
  });
  if (stuckInStage.length > 0) {
    signals.push({
      id: "deals-stuck-stage",
      title: "Deals lang in dezelfde fase",
      detail: `${stuckInStage.length} open deal(s) >${STUCK_STAGE_DAYS} dagen niet bijgewerkt — tijd voor volgende stap.`,
      severity: "attention",
      actionLabel: "Pijplijn",
      href: "/admin/ops/pipeline",
    });
  }

  const failedPay = input.clients.filter((c) => c.payment_status === "failed");
  if (failedPay.length > 0) {
    const sum = failedPay.length;
    signals.push({
      id: "pay-failed",
      title: "Mislukte betalingen",
      detail: `${sum} klant${sum === 1 ? "" : "en"} met payment_status failed — direct herstel.`,
      severity: "critical",
      actionLabel: "Naar klanten",
      href: "/admin/ops/clients",
    });
  }

  const now = Date.now();
  const staleDeals = input.deals.filter((d) => {
    if (isClosedDealStage(d.stage)) return false;
    const effDue = effectiveDealFollowUpDueAt(d);
    if (effDue) {
      const due = new Date(effDue).getTime();
      if (!Number.isNaN(due) && due < now - 3 * MS_DAY) return true;
    }
    if (!effectiveDealNextStepMessage(d) && d.value_cents >= 50_000) return true;
    return false;
  });
  if (staleDeals.length > 0) {
    signals.push({
      id: "deals-stale",
      title: "Deals zonder voortgang",
      detail: `${staleDeals.length} open deal(s): deadline gemist of geen volgende stap bij hoge waarde.`,
      severity: "critical",
      actionLabel: "Pijplijn",
      href: "/admin/ops/pipeline",
    });
  }

  const reviewQueue = input.websiteOps.filter(
    (w) => w.ops_status === "review" && w.review_status === "pending",
  );
  if (reviewQueue.length > 0) {
    signals.push({
      id: "web-review",
      title: "Sites wachten op review",
      detail: `${reviewQueue.length} site(s) in review met status pending.`,
      severity: "attention",
      actionLabel: "Websites",
      href: "/admin/ops/websites",
    });
  }

  const renewals = input.clients.filter((c) => renewalWithinDays(c.subscription_renews_at, 30));
  if (renewals.length > 0) {
    signals.push({
      id: "renewals",
      title: "Verlengingen binnen 30 dagen",
      detail: `${renewals.length} klant${renewals.length === 1 ? "" : "en"} met subscription_renews_at in venster.`,
      severity: "attention",
      actionLabel: "Klanten",
      href: "/admin/ops/clients",
    });
  }

  const overdueLeads = input.leads.filter((l) => {
    if (l.status === "converted" || l.status === "lost") return false;
    if (!l.next_follow_up_at) return false;
    const due = new Date(l.next_follow_up_at).getTime();
    return !Number.isNaN(due) && due < now;
  });
  if (overdueLeads.length > 0) {
    signals.push({
      id: "leads-followup",
      title: "Leads: follow-up te laat",
      detail: `${overdueLeads.length} lead(s) met next_follow_up_at in het verleden.`,
      severity: "critical",
      actionLabel: "Leads",
      href: "/admin/ops/leads",
    });
  }

  const blockedSites = input.websiteOps.filter((w) => w.blocker_status !== "none");
  if (blockedSites.length > 0) {
    signals.push({
      id: "web-blocked",
      title: "Websites met blocker",
      detail: `${blockedSites.length} site(s) hebben een actieve blocker (content/media/tech/billing).`,
      severity: "attention",
      actionLabel: "Websites",
      href: "/admin/ops/websites",
    });
  }

  const openPipeline = input.deals.filter((d) => !isClosedDealStage(d.stage));
  const atRiskDeals = openPipeline.filter((d) => d.at_risk);
  if (atRiskDeals.length > 0 && !signals.some((s) => s.id === "deals-stale")) {
    signals.push({
      id: "deals-at-risk",
      title: "Deals gemarkeerd als risico",
      detail: `${atRiskDeals.length} open deal(s) met risico-vlag (at_risk).`,
      severity: "attention",
      actionLabel: "Deals",
      href: "/admin/ops/deals",
    });
  }

  const severityOrder = { critical: 0, attention: 1, healthy: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  if (signals.length === 0) {
    return [
      {
        id: "all-clear",
        title: "Geen kritieke signalen",
        detail:
          "Er zijn nu geen mislukte betalingen, verlopen follow-ups of review-wachtrijen volgens de huidige regels.",
        severity: "healthy",
        actionLabel: "Pipeline",
        href: "/admin/ops/pipeline",
      },
    ];
  }

  return signals.slice(0, 8);
}

export type RevenueSnapshotMetrics = {
  openPipelineCents: number;
  weightedPipelineCents: number;
  won30dCount: number;
  won30dCents: number;
  renewals30dCount: number;
};

export function buildRevenueSnapshotMetrics(
  deals: SalesDealRow[],
  clients: AdminClientRow[],
): RevenueSnapshotMetrics {
  const now = Date.now();
  const d30 = now - 30 * MS_DAY;

  let openPipelineCents = 0;
  let weightedPipelineCents = 0;
  for (const d of deals) {
    if (isClosedDealStage(d.stage)) continue;
    openPipelineCents += d.value_cents;
    const p = d.probability != null ? d.probability / 100 : 0.35;
    weightedPipelineCents += Math.round(d.value_cents * p);
  }

  let won30dCount = 0;
  let won30dCents = 0;
  for (const d of deals) {
    if (d.stage !== "won" || !d.won_at) continue;
    const t = new Date(d.won_at).getTime();
    if (!Number.isNaN(t) && t >= d30) {
      won30dCount += 1;
      won30dCents += d.value_cents;
    }
  }

  const renewals30dCount = clients.filter((c) => renewalWithinDays(c.subscription_renews_at, 30)).length;

  return {
    openPipelineCents,
    weightedPipelineCents,
    won30dCount,
    won30dCents,
    renewals30dCount,
  };
}

/** Leesbare regel voor “waarom dit op de rail staat” (debug / tooltips). */
export function explainDealStale(d: SalesDealRow): string {
  if (isClosedDealStage(d.stage)) return "Deal gesloten.";
  const effDue = effectiveDealFollowUpDueAt(d);
  if (effDue) {
    const days = daysSince(effDue);
    if (days != null && days > 3) return `Volgende stap ${days} dagen over tijd.`;
  }
  if (!effectiveDealNextStepMessage(d) && d.value_cents >= 50_000) {
    return `Geen volgende stap; waarde ${formatEURFromCents(d.value_cents)}.`;
  }
  return "—";
}
