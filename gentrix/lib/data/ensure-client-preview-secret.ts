import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { generatePreviewSecret } from "@/lib/preview/preview-secret-crypto";

/**
 * Zorgt dat de klant een preview_secret heeft (voor `/site/{slug}?token=` conceptweergave).
 * Bestaande waarde blijft behouden.
 */
export async function ensureClientPreviewSecretBySlug(subfolderSlug: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.from("clients").select("id").eq("subfolder_slug", subfolderSlug).maybeSingle();
    if (error || !data?.id) return null;
    return ensureClientPreviewSecret(data.id);
  } catch {
    return null;
  }
}

export async function ensureClientPreviewSecret(clientId: string): Promise<string | null> {
  try {
    const supabase = createServiceRoleClient();
    let { data, error } = await supabase
      .from("clients")
      .select("preview_secret")
      .eq("id", clientId)
      .maybeSingle();

    if (error && isPostgrestUnknownColumnError(error, "preview_secret")) {
      return null;
    }
    if (error || !data) return null;

    const existing = (data as { preview_secret?: string | null }).preview_secret?.trim();
    if (existing) return existing;

    const secret = generatePreviewSecret();
    const { error: upErr } = await supabase
      .from("clients")
      .update({ preview_secret: secret, updated_at: new Date().toISOString() })
      .eq("id", clientId);

    if (upErr) {
      if (isPostgrestUnknownColumnError(upErr, "preview_secret")) return null;
      return null;
    }
    return secret;
  } catch {
    return null;
  }
}
