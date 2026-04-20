import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logSupabaseReadError } from "@/lib/supabase/missing-relation";
import type { SalesDealStage } from "@/lib/sales-os/deal-stages";

/** Eén vastgelegde planning-stap (Fase & planning → opslaan). */
export type SalesDealStepLogEntry = {
  message: string;
  due_at: string | null;
  logged_at: string;
  /** Wie de stap vastlegde (server; sinds apr 2026). */
  logged_by_label?: string | null;
};

export type SalesDealRow = {
  id: string;
  lead_id: string | null;
  client_id: string | null;
  company_name: string;
  title: string;
  stage: SalesDealStage;
  value_cents: number;
  currency: string;
  owner_label: string | null;
  probability: number | null;
  next_step: string | null;
  next_step_due_at: string | null;
  /** JSON-log van vastgelegde stappen; ontbreekt op oudere rijen tot migratie. */
  next_step_log?: SalesDealStepLogEntry[] | null;
  at_risk: boolean;
  lost_reason: string | null;
  won_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSalesDeals(): Promise<SalesDealRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_deals")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    logSupabaseReadError("[listSalesDeals]", error.message, { salesOsMigrationHint: true });
    return [];
  }
  return (data ?? []) as unknown as SalesDealRow[];
}

export async function getSalesDealById(id: string): Promise<SalesDealRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("sales_deals").select("*").eq("id", id).maybeSingle();
  if (error) {
    logSupabaseReadError("[getSalesDealById]", error.message, { salesOsMigrationHint: true });
    return null;
  }
  return data as SalesDealRow | null;
}

export async function listSalesDealsForClient(clientId: string): Promise<SalesDealRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_deals")
    .select("*")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });
  if (error) {
    logSupabaseReadError("[listSalesDealsForClient]", error.message, { salesOsMigrationHint: true });
    return [];
  }
  return (data ?? []) as unknown as SalesDealRow[];
}
