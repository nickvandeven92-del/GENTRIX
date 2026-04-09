import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseMissingRelationError } from "@/lib/supabase/missing-relation";

export type SalesInsightsStats = {
  generationRunsTotal: number;
  generationRunsLast30d: number;
  dealsOpen: number;
  dealsWonAllTime: number;
  tasksOpen: number;
};

export async function getSalesInsightsStats(): Promise<SalesInsightsStats | null> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const runsAll = await supabase.from("site_generation_runs").select("id", { count: "exact", head: true });
  if (runsAll.error && isSupabaseMissingRelationError(runsAll.error.message)) {
    return null;
  }

  const runs30 = await supabase
    .from("site_generation_runs")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  const dealsOpen = await supabase
    .from("sales_deals")
    .select("id", { count: "exact", head: true })
    .neq("stage", "won")
    .neq("stage", "lost");

  const dealsWon = await supabase.from("sales_deals").select("id", { count: "exact", head: true }).eq("stage", "won");

  const tasksOpen = await supabase.from("sales_tasks").select("id", { count: "exact", head: true }).eq("status", "open");

  const tasksMissing =
    tasksOpen.error && isSupabaseMissingRelationError(tasksOpen.error.message);

  if (dealsOpen.error && isSupabaseMissingRelationError(dealsOpen.error.message)) {
    return {
      generationRunsTotal: runsAll.count ?? 0,
      generationRunsLast30d: runs30.count ?? 0,
      dealsOpen: 0,
      dealsWonAllTime: 0,
      tasksOpen: 0,
    };
  }

  return {
    generationRunsTotal: runsAll.count ?? 0,
    generationRunsLast30d: runs30.count ?? 0,
    dealsOpen: dealsOpen.count ?? 0,
    dealsWonAllTime: dealsWon.count ?? 0,
    tasksOpen: tasksMissing ? 0 : (tasksOpen.count ?? 0),
  };
}
