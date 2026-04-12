import {
  parseFlyerStudioPersisted,
  type FlyerStudioPersisted,
} from "@/lib/flyer/flyer-studio-schema";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function fetchFlyerStudioJson(supabase: SupabaseClient, slug: string): Promise<unknown | null> {
  const { data, error } = await supabase.from("clients").select("flyer_studio_json").eq("subfolder_slug", slug).maybeSingle();
  if (error && isPostgrestUnknownColumnError(error, "flyer_studio_json")) {
    return null;
  }
  if (error || !data) return null;
  return (data as { flyer_studio_json?: unknown }).flyer_studio_json ?? null;
}

/** Admin SSR: flyerstudio-json per klant (fallback leeg). */
export async function getClientFlyerStudioBySlugForAdmin(slug: string): Promise<FlyerStudioPersisted> {
  const supabase = await createSupabaseServerClient();
  const raw = await fetchFlyerStudioJson(supabase, slug);
  return parseFlyerStudioPersisted(raw);
}

/** Service role (API-routes). */
export async function getClientFlyerStudioBySlugService(slug: string): Promise<FlyerStudioPersisted> {
  const supabase = createServiceRoleClient();
  const raw = await fetchFlyerStudioJson(supabase, slug);
  return parseFlyerStudioPersisted(raw);
}
