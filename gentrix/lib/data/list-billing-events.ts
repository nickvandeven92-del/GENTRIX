import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BillingEventRow = {
  id: string;
  client_id: string;
  event_type: string;
  occurred_at: string;
  actor: string;
  payment_attempt_id: string | null;
  amount: string | null;
  metadata: Record<string, unknown>;
  note: string | null;
  created_at: string;
};

export async function listBillingEvents(clientId: string): Promise<BillingEventRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("billing_events")
    .select(
      "id, client_id, event_type, occurred_at, actor, " +
        "payment_attempt_id, amount, metadata, note, created_at",
    )
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false });

  if (error) {
    console.error("[listBillingEvents]", error.message);
    return [];
  }
  return (data ?? []) as unknown as BillingEventRow[];
}
