import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function listActiveClientStaffIds(clientId: string): Promise<string[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("client_staff")
    .select("id")
    .eq("client_id", clientId)
    .eq("is_active", true);

  if (error?.message?.includes("client_staff") || error?.code === "42P01") return [];
  if (error || !data?.length) return [];
  return data.map((r) => r.id as string);
}
