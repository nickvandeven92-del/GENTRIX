import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { GenerationPackageId } from "@/lib/ai/generation-packages";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type AdminClientFullRow = {
  id: string;
  name: string;
  description: string | null;
  subfolder_slug: string;
  status: "draft" | "active" | "paused" | "archived";
  site_data_json: unknown;
  updated_at: string;
  generation_package: GenerationPackageId | null;
  appointments_enabled: boolean;
  webshop_enabled: boolean;
};

const ADMIN_FULL_WITH_PKG =
  "id, name, description, subfolder_slug, status, site_data_json, updated_at, generation_package, appointments_enabled, webshop_enabled";
const ADMIN_FULL_WITHOUT_PKG =
  "id, name, description, subfolder_slug, status, site_data_json, updated_at";

export async function getAdminClientBySlug(slug: string): Promise<AdminClientFullRow | null> {
  const supabase = await createSupabaseServerClient();
  let { data, error } = await supabase
    .from("clients")
    .select(ADMIN_FULL_WITH_PKG)
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "generation_package")) {
    const second = await supabase
      .from("clients")
      .select(ADMIN_FULL_WITHOUT_PKG)
      .eq("subfolder_slug", slug)
      .maybeSingle();
    if (second.error || !second.data) return null;
    return {
      ...(second.data as unknown as Omit<
        AdminClientFullRow,
        "generation_package" | "appointments_enabled" | "webshop_enabled"
      >),
      generation_package: null,
      appointments_enabled: false,
      webshop_enabled: false,
    };
  }

  if (error || !data) return null;
  return data as AdminClientFullRow;
}
