import { createSupabaseServerClient } from "@/lib/supabase/server";
import { escapeForIlike, searchTerms } from "@/lib/commercial/ilike-search";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type AdminClientRow = {
  id: string;
  name: string;
  subfolder_slug: string;
  status: "draft" | "active" | "paused" | "archived";
  updated_at: string;
  generation_package: string | null;
  plan_type: string | null;
  plan_label: string | null;
  payment_status: string;
  pipeline_stage: string;
  subscription_renews_at: string | null;
  billing_email: string | null;
  custom_domain: string | null;
  /** Ontbreekt op oudere callers die een deelselectie doorgeven. */
  client_number?: string | null;
};

const SEL_PKG_NUM =
  "id, name, subfolder_slug, status, updated_at, generation_package, plan_type, plan_label, payment_status, pipeline_stage, subscription_renews_at, billing_email, custom_domain, client_number";
const SEL_PKG =
  "id, name, subfolder_slug, status, updated_at, generation_package, plan_type, plan_label, payment_status, pipeline_stage, subscription_renews_at, billing_email, custom_domain";
const SEL_BASE =
  "id, name, subfolder_slug, status, updated_at, plan_type, plan_label, payment_status, pipeline_stage, subscription_renews_at, billing_email, custom_domain";

export type ListAdminClientsOptions = {
  search?: string | null;
};

export async function listAdminClients(options?: ListAdminClientsOptions): Promise<AdminClientRow[]> {
  const supabase = await createSupabaseServerClient();
  const order = { ascending: false } as const;
  const term = searchTerms(options?.search ?? undefined);
  const pattern = term ? `%${escapeForIlike(term)}%` : null;

  let q1 = supabase.from("clients").select(SEL_PKG_NUM).order("updated_at", order);
  if (pattern) q1 = q1.or(`name.ilike.${pattern},client_number.ilike.${pattern}`);
  let { data, error } = await q1;

  if (error && isPostgrestUnknownColumnError(error, "client_number")) {
    let q2 = supabase.from("clients").select(SEL_PKG).order("updated_at", order);
    if (pattern) q2 = q2.ilike("name", pattern);
    const second = await q2;
    if (second.error && isPostgrestUnknownColumnError(second.error, "generation_package")) {
      let q3 = supabase.from("clients").select(SEL_BASE).order("updated_at", order);
      if (pattern) q3 = q3.ilike("name", pattern);
      const third = await q3;
      if (third.error || !third.data) return [];
      return (third.data as Omit<AdminClientRow, "generation_package" | "client_number">[]).map((row) => ({
        ...row,
        generation_package: null,
        client_number: null,
      })) as AdminClientRow[];
    }
    if (second.error || !second.data) return [];
    return (second.data as Omit<AdminClientRow, "client_number">[]).map((r) => ({
      ...r,
      client_number: null,
    })) as AdminClientRow[];
  }

  if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
    let q2 = supabase.from("clients").select(SEL_BASE).order("updated_at", order);
    if (pattern) q2 = q2.ilike("name", pattern);
    const second = await q2;
    if (second.error || !second.data) return [];
    return (second.data as Omit<AdminClientRow, "generation_package" | "client_number">[]).map((row) => ({
      ...row,
      generation_package: null,
      client_number: null,
    })) as AdminClientRow[];
  }

  if (error || !data) return [];

  return data as AdminClientRow[];
}
