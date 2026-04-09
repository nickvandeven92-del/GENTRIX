import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logSupabaseReadError } from "@/lib/supabase/missing-relation";

export type SalesTaskStatus = "open" | "done" | "cancelled";
export type SalesTaskPriority = "low" | "normal" | "high" | "urgent";
export type SalesTaskLinkedType = "lead" | "deal" | "client" | "website";
export type SalesTaskSource = "manual" | "rule" | "system";

export type SalesTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: SalesTaskStatus;
  priority: SalesTaskPriority;
  due_at: string | null;
  owner_label: string | null;
  linked_entity_type: SalesTaskLinkedType;
  linked_entity_id: string;
  source_type: SalesTaskSource;
  created_at: string;
  completed_at: string | null;
  updated_at: string;
};

const PRIORITY_ORDER: Record<SalesTaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function sortTasks(rows: SalesTaskRow[]): SalesTaskRow[] {
  return [...rows].sort((a, b) => {
    const pd = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (pd !== 0) return pd;
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at.localeCompare(b.due_at);
  });
}

export async function listSalesTasks(): Promise<SalesTaskRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("sales_tasks").select("*");
  if (error) {
    logSupabaseReadError("[listSalesTasks]", error.message, { salesOsMigrationHint: true });
    return [];
  }
  return sortTasks((data ?? []) as SalesTaskRow[]);
}

export async function listOpenSalesTasksForOverview(limit = 12): Promise<SalesTaskRow[]> {
  const all = await listSalesTasks();
  const open = all.filter((t) => t.status === "open");
  return open.slice(0, limit);
}

export async function listSalesTasksForLinked(
  type: SalesTaskLinkedType,
  entityId: string,
): Promise<SalesTaskRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_tasks")
    .select("*")
    .eq("linked_entity_type", type)
    .eq("linked_entity_id", entityId);
  if (error) {
    logSupabaseReadError("[listSalesTasksForLinked]", error.message, { salesOsMigrationHint: true });
    return [];
  }
  return sortTasks((data ?? []) as SalesTaskRow[]);
}
