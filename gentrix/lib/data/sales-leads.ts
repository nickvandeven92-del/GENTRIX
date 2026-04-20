import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logSupabaseReadError } from "@/lib/supabase/missing-relation";

export type SalesLeadStatus = "new" | "working" | "qualified" | "lost" | "converted";

export type SalesLeadRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: SalesLeadStatus;
  owner_label: string | null;
  budget_estimate: string | null;
  notes: string | null;
  /** Server-only: idempotentie voor cron follow-up notities. */
  follow_up_reminder_state?: unknown;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
  converted_deal_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSalesLeads(): Promise<SalesLeadRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    logSupabaseReadError("[listSalesLeads]", error.message, { salesOsMigrationHint: true });
    return [];
  }
  return (data ?? []) as unknown as SalesLeadRow[];
}

export async function getSalesLeadById(id: string): Promise<SalesLeadRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("sales_leads").select("*").eq("id", id).maybeSingle();
  if (error) {
    logSupabaseReadError("[getSalesLeadById]", error.message, { salesOsMigrationHint: true });
    return null;
  }
  return data as SalesLeadRow | null;
}
