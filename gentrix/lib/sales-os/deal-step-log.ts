import type { SalesDealRow, SalesDealStepLogEntry } from "@/lib/data/sales-deals";
import { isClosedDealStage } from "@/lib/sales-os/deal-stages";

export function parseDealStepLog(raw: SalesDealRow["next_step_log"]): SalesDealStepLogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SalesDealStepLogEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item.message !== "string" || typeof item.logged_at !== "string") continue;
    out.push({
      message: item.message,
      due_at: typeof item.due_at === "string" ? item.due_at : null,
      logged_at: item.logged_at,
      logged_by_label:
        typeof item.logged_by_label === "string" && item.logged_by_label.trim()
          ? item.logged_by_label.trim()
          : null,
    });
  }
  return out;
}

/** Nieuwste vastgelegde stap (op logged_at). */
export function newestDealStepLogEntry(log: SalesDealStepLogEntry[]): SalesDealStepLogEntry | null {
  if (log.length === 0) return null;
  let best = log[0]!;
  let bestT = new Date(best.logged_at).getTime();
  for (let i = 1; i < log.length; i++) {
    const t = new Date(log[i]!.logged_at).getTime();
    if (!Number.isNaN(t) && t >= bestT) {
      best = log[i]!;
      bestT = t;
    }
  }
  return best;
}

/** Opvolgdatum voor dashboard/pijplijn: actieve planning, anders laatste log. */
export function effectiveDealFollowUpDueAt(deal: SalesDealRow): string | null {
  if (deal.next_step_due_at) return deal.next_step_due_at;
  const n = newestDealStepLogEntry(parseDealStepLog(deal.next_step_log));
  return n?.due_at ?? null;
}

/** Tekst volgende stap voor kaarten: actief veld, anders laatste log. */
export function effectiveDealNextStepMessage(deal: SalesDealRow): string | null {
  const t = deal.next_step?.trim();
  if (t) return t;
  const n = newestDealStepLogEntry(parseDealStepLog(deal.next_step_log));
  const m = n?.message?.trim();
  return m || null;
}

export type DealFollowUpDashboardRow = {
  deal: SalesDealRow;
  dueAt: string | null;
  message: string | null;
};

/**
 * Open deals met een zichtbare volgende stap en/of opvolgdatum (actief of uit stap-log),
 * gesorteerd: het eerst aflopen (of gemist), daarna komende deadlines.
 */
export function openDealsForFollowUpList(deals: SalesDealRow[]): DealFollowUpDashboardRow[] {
  const open = deals.filter((d) => !isClosedDealStage(d.stage));
  const rows: DealFollowUpDashboardRow[] = [];
  for (const deal of open) {
    const message = effectiveDealNextStepMessage(deal);
    const dueAt = effectiveDealFollowUpDueAt(deal);
    if (!message?.trim() && !dueAt) continue;
    rows.push({ deal, dueAt, message });
  }
  const now = Date.now();
  function tierAndKey(due: string | null): [number, number] {
    if (!due) return [2, 0];
    const t = new Date(due).getTime();
    if (Number.isNaN(t)) return [2, 0];
    if (t < now) return [0, t];
    return [1, t];
  }
  rows.sort((a, b) => {
    const [ia, ka] = tierAndKey(a.dueAt);
    const [ib, kb] = tierAndKey(b.dueAt);
    if (ia !== ib) return ia - ib;
    if (ka !== kb) return ka - kb;
    return a.deal.company_name.localeCompare(b.deal.company_name, "nl");
  });
  return rows;
}
