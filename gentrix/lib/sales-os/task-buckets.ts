import type { SalesTaskRow } from "@/lib/data/sales-tasks";

const MS_DAY = 86_400_000;

function startOfToday(): number {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Open taken groeperen: overdue, vandaag, deze week (7 dagen venster), later. */
export function bucketOpenTasks(tasks: SalesTaskRow[]): {
  overdue: SalesTaskRow[];
  today: SalesTaskRow[];
  week: SalesTaskRow[];
  later: SalesTaskRow[];
} {
  const open = tasks.filter((t) => t.status === "open");
  const sod = startOfToday();
  const weekEnd = sod + 7 * MS_DAY;

  const overdue: SalesTaskRow[] = [];
  const today: SalesTaskRow[] = [];
  const week: SalesTaskRow[] = [];
  const later: SalesTaskRow[] = [];

  for (const t of open) {
    if (!t.due_at) {
      later.push(t);
      continue;
    }
    const tDue = new Date(t.due_at).getTime();
    if (Number.isNaN(tDue)) {
      later.push(t);
      continue;
    }
    if (tDue < sod) overdue.push(t);
    else if (tDue < sod + MS_DAY) today.push(t);
    else if (tDue < weekEnd) week.push(t);
    else later.push(t);
  }

  return { overdue, today, week, later };
}
