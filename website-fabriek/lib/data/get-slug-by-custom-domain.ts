import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Zoekt actieve klant bij exact opgeslagen custom_domain (hostname, zonder https).
 * Optioneel: ook variant met/zonder www als er geen match is.
 */
export async function getSlugByCustomDomain(hostname: string): Promise<string | null> {
  const h = hostname.trim().toLowerCase();
  if (!h) return null;

  try {
    const supabase = createServiceRoleClient();
    const alt = h.startsWith("www.") ? h.slice(4) : `www.${h}`;
    const variants = [...new Set([h, alt])];

    const { data, error } = await supabase
      .from("clients")
      .select("subfolder_slug")
      .eq("status", "active")
      .in("custom_domain", variants)
      .limit(1)
      .maybeSingle();

    if (!error && data?.subfolder_slug) return data.subfolder_slug;
  } catch {
    return null;
  }

  return null;
}
