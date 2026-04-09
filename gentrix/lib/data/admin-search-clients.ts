import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminSearchClientHit = {
  id: string;
  name: string;
  subfolder_slug: string;
  status: string;
};

/** Verwijdert LIKE-wildcards uit gebruikersinvoer (veiligere ilike). */
function sanitizeSearchQuery(raw: string): string {
  return raw.trim().replace(/%/g, "").replace(/_/g, "").slice(0, 80);
}

export async function searchAdminClients(query: string, limit = 20): Promise<AdminSearchClientHit[]> {
  const q = sanitizeSearchQuery(query);
  if (q.length < 2) return [];

  const pattern = `%${q}%`;

  try {
    const supabase = createServiceRoleClient();
    const [{ data: byName, error: e1 }, { data: bySlug, error: e2 }] = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, subfolder_slug, status")
        .ilike("name", pattern)
        .order("updated_at", { ascending: false })
        .limit(limit),
      supabase
        .from("clients")
        .select("id, name, subfolder_slug, status")
        .ilike("subfolder_slug", pattern)
        .order("updated_at", { ascending: false })
        .limit(limit),
    ]);

    if (e1 && e2) return [];

    const map = new Map<string, AdminSearchClientHit>();
    for (const row of [...(byName ?? []), ...(bySlug ?? [])]) {
      const r = row as AdminSearchClientHit;
      map.set(r.id, r);
    }
    return Array.from(map.values()).slice(0, limit);
  } catch {
    return [];
  }
}
