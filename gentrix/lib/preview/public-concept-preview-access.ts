import { previewSecretsEqual } from "@/lib/preview/preview-secret-crypto";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

export type PublicConceptPreviewAccess = "ok" | "not_found" | "redirect_active";

/**
 * Valideert `token` voor oude `/preview/[slug]`-routes (redirect naar `/site/...?token=`).
 */
export async function getPublicConceptPreviewAccess(
  subfolderSlug: string,
  token: string,
): Promise<PublicConceptPreviewAccess> {
  const trimmed = token.trim();
  if (!trimmed) return "not_found";

  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("clients")
    .select("preview_secret, status")
    .eq("subfolder_slug", subfolderSlug)
    .maybeSingle();

  if (error && isPostgrestUnknownColumnError(error, "preview_secret")) {
    return "not_found";
  }
  if (error || !row) return "not_found";

  if (row.status === "active") {
    return "redirect_active";
  }

  const secret = (row as { preview_secret?: string | null }).preview_secret;
  if (!previewSecretsEqual(secret ?? null, trimmed)) {
    return "not_found";
  }

  return "ok";
}
