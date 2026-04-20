import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PaymentAttemptRow = {
  id: string;
  client_id: string;
  attempted_at: string;
  amount: string;
  currency: string;
  period_label: string | null;
  mollie_payment_id: string | null;
  mollie_subscription_id: string | null;
  status: string;
  failure_reason: string | null;
  webhook_received_at: string | null;
  manual_note: string | null;
  created_at: string;
};

export async function listPaymentAttempts(clientId: string): Promise<PaymentAttemptRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_attempts")
    .select(
      "id, client_id, attempted_at, amount, currency, period_label, " +
        "mollie_payment_id, mollie_subscription_id, status, failure_reason, " +
        "webhook_received_at, manual_note, created_at",
    )
    .eq("client_id", clientId)
    .order("attempted_at", { ascending: false });

  if (error) {
    console.error("[listPaymentAttempts]", error.message);
    return [];
  }
  return (data ?? []) as PaymentAttemptRow[];
}
