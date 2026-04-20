import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SepaMandateRow = {
  id: string;
  client_id: string;
  mollie_mandate_id: string | null;
  mandate_reference: string;
  mandate_date: string;
  iban_last4: string;
  account_holder: string | null;
  bank_name: string | null;
  status: string;
  prenotification_agreement: string | null;
  consent_text_version: string | null;
  consent_at: string | null;
  consent_ip: string | null;
  confirmation_email_sent: boolean;
  created_at: string;
  updated_at: string;
};

export async function listSepaMandates(clientId: string): Promise<SepaMandateRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sepa_mandates")
    .select(
      "id, client_id, mollie_mandate_id, mandate_reference, mandate_date, " +
        "iban_last4, account_holder, bank_name, status, prenotification_agreement, " +
        "consent_text_version, consent_at, consent_ip, confirmation_email_sent, " +
        "created_at, updated_at",
    )
    .eq("client_id", clientId)
    .order("mandate_date", { ascending: false });

  if (error) {
    console.error("[listSepaMandates]", error.message);
    return [];
  }
  return (data ?? []) as unknown as SepaMandateRow[];
}
