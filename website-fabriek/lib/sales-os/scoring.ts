import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import type { WebsiteOpsRow } from "@/lib/data/website-ops";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";
import { effectiveDealFollowUpDueAt, effectiveDealNextStepMessage } from "@/lib/sales-os/deal-step-log";

/** 0–100: hoger = gezonder. Transparante regels, geen ML. */
export function getClientHealthScore(c: AdminClientRow): number {
  let score = 70;
  if (c.status === "active") score += 15;
  if (c.status === "draft") score -= 5;
  if (c.status === "paused" || c.status === "archived") score -= 15;
  if (c.payment_status === "paid") score += 10;
  if (c.payment_status === "pending") score -= 15;
  if (c.payment_status === "failed") score -= 35;
  if (c.payment_status === "none") score -= 5;
  return Math.max(0, Math.min(100, score));
}

export type ChurnRiskLevel = "low" | "med" | "high";

export function getChurnRiskLevel(c: AdminClientRow): ChurnRiskLevel {
  if (c.payment_status === "failed") return "high";
  if (c.payment_status === "pending" && c.status === "draft") return "high";
  if (c.payment_status === "pending") return "med";
  if (c.status === "paused") return "med";
  return "low";
}

/** Simpele upsell-hint op basis van plan + status. */
export function getUpsellHint(c: AdminClientRow): string {
  if (c.plan_type === "subscription" && c.status === "active") return "Extra pagina’s / portaal";
  if (c.plan_type === "one_time" && c.status === "active") return "Onderhoudsabonnement";
  if (!c.plan_type || c.plan_type === "trial") return "Upgrade naar vast pakket";
  return "—";
}

/** Deal-urgentie voor sortering: hoger = eerder aanpakken. */
export function getDealUrgencyScore(d: SalesDealRow): number {
  if (isClosedDealStage(d.stage)) return 0;
  let u = 10;
  if (d.at_risk) u += 40;
  if (d.value_cents >= 500_000) u += 25;
  else if (d.value_cents >= 100_000) u += 15;
  const effDue = effectiveDealFollowUpDueAt(d);
  const due = effDue ? new Date(effDue).getTime() : null;
  const now = Date.now();
  if (due != null && !Number.isNaN(due)) {
    if (due < now) u += 30;
    else if (due < now + 2 * 86_400_000) u += 15;
  } else if (!effectiveDealNextStepMessage(d)) {
    u += 20;
  }
  return u;
}

export function getWebsiteBlockerSummary(w: WebsiteOpsRow): string {
  if (w.blocker_status === "none" || !w.blocker_status) return "Geen blocker";
  return w.blocker_reason?.trim() || `Blocker: ${w.blocker_status}`;
}

export function isPublishReadyFromOps(w: WebsiteOpsRow): boolean {
  return w.publish_ready && w.blocker_status === "none";
}
