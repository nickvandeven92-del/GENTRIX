import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Laatste klantnamen voor anti-template context in de Claude-prompt.
 * Faalt stil als service role ontbreekt of DB niet bereikbaar is.
 */
export async function getRecentClientNamesForPrompt(limit = 3): Promise<string[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("name")
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error || !data?.length) return [];

    return data
      .map((r: { name: string }) => r.name)
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  } catch {
    return [];
  }
}
