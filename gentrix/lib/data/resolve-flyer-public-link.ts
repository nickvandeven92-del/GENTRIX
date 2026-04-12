import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { ClientStatus } from "@/lib/types/database";

export type FlyerPublicLinkResolution =
  | { kind: "live"; slug: string }
  | { kind: "concept"; slug: string; previewSecret: string }
  | null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isFlyerPublicTokenFormat(raw: string): boolean {
  return UUID_RE.test(raw.trim());
}

/**
 * `/p/{flyer_public_token}`: resolve naar live slug of concept met preview_secret.
 */
export async function resolveFlyerPublicLink(rawToken: string): Promise<FlyerPublicLinkResolution> {
  const token = rawToken.trim();
  if (!isFlyerPublicTokenFormat(token)) return null;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("subfolder_slug, status, preview_secret")
      .eq("flyer_public_token", token)
      .maybeSingle();

    if (error && isPostgrestUnknownColumnError(error, "flyer_public_token")) {
      return null;
    }
    if (error || !data) return null;

    const slug = String((data as { subfolder_slug: string }).subfolder_slug ?? "").trim();
    if (!slug) return null;

    const status = (data as { status: ClientStatus }).status;
    if (status === "active") {
      return { kind: "live", slug };
    }

    const secret = (data as { preview_secret?: string | null }).preview_secret?.trim() ?? "";
    if (!secret) {
      return null;
    }
    return { kind: "concept", slug, previewSecret: secret };
  } catch {
    return null;
  }
}
