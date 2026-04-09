import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logSupabaseReadError } from "@/lib/supabase/missing-relation";

export type WebsiteOpsStatus =
  | "briefing"
  | "generating"
  | "review"
  | "revisions"
  | "ready"
  | "live";

export type WebsiteReviewStatus = "none" | "pending" | "approved" | "changes_requested";
export type WebsiteBlockerStatus = "none" | "content" | "media" | "technical" | "billing" | "other";

export type WebsiteOpsRow = {
  id: string;
  client_id: string;
  ops_status: WebsiteOpsStatus;
  review_status: WebsiteReviewStatus;
  blocker_status: WebsiteBlockerStatus;
  blocker_reason: string | null;
  quality_score: number | null;
  content_completeness: number | null;
  media_completeness: number | null;
  publish_ready: boolean;
  last_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WebsiteOpsWithClient = WebsiteOpsRow & {
  client_name: string;
  subfolder_slug: string;
  client_status: string;
  custom_domain: string | null;
};

export async function listWebsiteOpsWithClients(): Promise<WebsiteOpsWithClient[]> {
  const supabase = await createSupabaseServerClient();
  const { data: ops, error: e1 } = await supabase
    .from("website_ops_state")
    .select("*")
    .order("updated_at", { ascending: false });
  if (e1) {
    logSupabaseReadError("[listWebsiteOpsWithClients]", e1.message, { salesOsMigrationHint: true });
    return [];
  }
  const { data: clients, error: e2 } = await supabase
    .from("clients")
    .select("id, name, subfolder_slug, status, custom_domain");
  if (e2) {
    logSupabaseReadError("[listWebsiteOpsWithClients/clients]", e2.message);
    return [];
  }
  const byId = new Map((clients ?? []).map((c) => [c.id, c]));
  return (ops ?? []).map((o) => {
    const row = o as WebsiteOpsRow;
    const c = byId.get(row.client_id);
    return {
      ...row,
      client_name: c?.name ?? "—",
      subfolder_slug: c?.subfolder_slug ?? "",
      client_status: c?.status ?? "",
      custom_domain: c?.custom_domain ?? null,
    };
  });
}

export async function getWebsiteOpsByClientId(clientId: string): Promise<WebsiteOpsRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("website_ops_state")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    logSupabaseReadError("[getWebsiteOpsByClientId]", error.message, { salesOsMigrationHint: true });
    return null;
  }
  return data as WebsiteOpsRow | null;
}
