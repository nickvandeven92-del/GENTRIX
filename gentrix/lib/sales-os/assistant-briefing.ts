import type { AdminClientRow } from "@/lib/data/list-admin-clients";
import type { SalesDealRow } from "@/lib/data/sales-deals";
import type { SalesLeadRow } from "@/lib/data/sales-leads";
import type { SalesTaskRow } from "@/lib/data/sales-tasks";
import type { WebsiteOpsWithClient } from "@/lib/data/website-ops";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";
import { effectiveDealFollowUpDueAt, effectiveDealNextStepMessage } from "@/lib/sales-os/deal-step-log";
import { formatEURFromCents } from "@/lib/sales-os/format-money";

const MS_DAY = 86_400_000;

function isMondayAmsterdam(d = new Date()): boolean {
  const wd = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    timeZone: "Europe/Amsterdam",
  }).format(d);
  return wd.toLowerCase().startsWith("maandag");
}

function openDealsValueCents(deals: SalesDealRow[]): number {
  return deals.filter((d) => !isClosedDealStage(d.stage)).reduce((a, d) => a + d.value_cents, 0);
}

export type AssistantBriefingJump = { label: string; href: string };

export type AssistantBriefing = {
  /** Korte zin: wat vandaag telt. */
  summary: string;
  jumpLinks: AssistantBriefingJump[];
  /** Alleen op maandag (Amsterdam): weekstart-regel. */
  weekLine: string | null;
};

/**
 * Dagstart-samenvatting + optionele weekstart (maandag) voor het commandocentrum.
 */
export function buildAssistantBriefing(input: {
  clients: AdminClientRow[];
  deals: SalesDealRow[];
  websiteOps: WebsiteOpsWithClient[];
  leads: SalesLeadRow[];
  tasks: SalesTaskRow[];
}): AssistantBriefing {
  const now = Date.now();
  const openTasks = input.tasks.filter((t) => t.status === "open");
  const overdueTasks = openTasks.filter((t) => {
    if (!t.due_at) return false;
    const due = new Date(t.due_at).getTime();
    return !Number.isNaN(due) && due < now;
  });

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

  const reviewQueue = input.websiteOps.filter(
    (w) => w.ops_status === "review" && w.review_status === "pending",
  );

  const overdueLeads = input.leads.filter((l) => {
    if (l.status === "converted" || l.status === "lost") return false;
    if (!l.next_follow_up_at) return false;
    const due = new Date(l.next_follow_up_at).getTime();
    return !Number.isNaN(due) && due < now;
  });

  const failedPay = input.clients.filter((c) => c.payment_status === "failed").length;

  const parts: string[] = [];
  if (failedPay > 0) {
    parts.push(`${failedPay} mislukte betaling${failedPay === 1 ? "" : "en"}`);
  }
  if (overdueTasks.length > 0) {
    parts.push(
      `${overdueTasks.length} ${overdueTasks.length === 1 ? "taak" : "taken"} te laat (${openTasks.length} open)`,
    );
  } else if (openTasks.length > 0) {
    parts.push(`${openTasks.length} open ${openTasks.length === 1 ? "taak" : "taken"}`);
  }
  if (staleDeals.length > 0) {
    parts.push(`${staleDeals.length} deal(s) zonder voortgang`);
  }
  if (reviewQueue.length > 0) {
    parts.push(`${reviewQueue.length} site(s) in review`);
  }
  if (overdueLeads.length > 0) {
    parts.push(`${overdueLeads.length} lead(s) follow-up gemist`);
  }

  const summary =
    parts.length > 0
      ? `Vandaag: ${parts.join(" · ")}.`
      : "Vandaag: geen harde waarschuwingen volgens de huidige regels — houd pijplijn en klanten bij (zie snelknoppen).";

  const jumpLinks: AssistantBriefingJump[] = [
    { label: "Prioriteiten", href: "/admin/ops#prioriteiten" },
    { label: "Taken", href: "/admin/ops/tasks" },
    { label: "Pijplijn", href: "/admin/ops#pipeline" },
    { label: "Gezondheid", href: "/admin/ops#gezondheid" },
    { label: "Website-bord", href: "/admin/ops/websites#levering" },
  ];

  let weekLine: string | null = null;
  if (isMondayAmsterdam()) {
    const openDeals = input.deals.filter((d) => !isClosedDealStage(d.stage));
    const openVal = openDealsValueCents(input.deals);
    const notLive = input.websiteOps.filter((w) => w.ops_status !== "live").length;
    weekLine = `Weekstart: ${openDeals.length} open deal(s), ${formatEURFromCents(openVal)} in pijplijn · ${notLive} site(s) nog niet live.`;
  }

  return { summary, jumpLinks, weekLine };
}
