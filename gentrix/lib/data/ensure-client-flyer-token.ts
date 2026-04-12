import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

/**
 * Zorgt dat de klant een `flyer_public_token` heeft (korte `/p/{uuid}`-link).
 */
export async function ensureClientFlyerPublicTokenBySlug(subfolderSlug: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, flyer_public_token")
      .eq("subfolder_slug", subfolderSlug)
      .maybeSingle();

    if (error && isPostgrestUnknownColumnError(error, "flyer_public_token")) {
      return null;
    }
    if (error || !data?.id) return null;

    const existing = (data as { flyer_public_token?: string | null }).flyer_public_token?.trim();
    if (existing) return existing;

    const fresh = randomUUID();
    const { error: upErr } = await supabase
      .from("clients")
      .update({ flyer_public_token: fresh, updated_at: new Date().toISOString() })
      .eq("id", data.id);

    if (upErr) {
      if (isPostgrestUnknownColumnError(upErr, "flyer_public_token")) return null;
      return null;
    }
    return fresh;
  } catch {
    return null;
  }
}
