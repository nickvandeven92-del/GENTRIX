import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Transactionele mail (afspraken) naar factuur-e-mail van de klant.
 */
export async function getClientNotificationTarget(
  clientId: string,
): Promise<{ email: string | null; name: string }> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("billing_email, name")
      .eq("id", clientId)
      .maybeSingle();

    if (error || !data) {
      return { email: null, name: "Klant" };
    }
    const row = data as { billing_email: string | null; name: string };
    return {
      email: row.billing_email?.trim() || null,
      name: row.name?.trim() || "Klant",
    };
  } catch {
    return { email: null, name: "Klant" };
  }
}
