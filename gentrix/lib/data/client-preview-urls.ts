import { ensureClientPreviewSecretBySlug } from "@/lib/data/ensure-client-preview-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { ClientStatus } from "@/lib/types/database";

export type ClientSiteUrlsForAdmin = {
  status: ClientStatus;
  /** Absolute URL naar definitieve live site (/site/{slug}). */
  liveAbsolute: string;
  /** Bij concept of gepauzeerd + preview_secret: URL met token. */
  previewAbsolute: string | null;
};

/**
 * Bepaalt welke publieke URLs relevant zijn voor het dossier (admin).
 * Live is alleen zichtbaar voor bezoekers als status === active (en inhoud gepubliceerd).
 */
export async function getClientSiteUrlsForAdminDossier(
  slug: string,
  origin: string | null,
): Promise<ClientSiteUrlsForAdmin | null> {
  const base = (origin ?? "").replace(/\/$/, "");
  const enc = encodeURIComponent(slug);
  const liveAbsolute = `${base}/site/${enc}`;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("status, preview_secret")
      .eq("subfolder_slug", slug)
      .maybeSingle();

    if (error && isPostgrestUnknownColumnError(error, "preview_secret")) {
      const second = await supabase.from("clients").select("status").eq("subfolder_slug", slug).maybeSingle();
      if (second.error || !second.data) return null;
      const st = second.data.status as ClientStatus;
      return {
        status: st,
        liveAbsolute,
        previewAbsolute: null,
      };
    }

    if (error || !data) return null;

    const status = data.status as ClientStatus;
    let secret = (data as { preview_secret?: string | null }).preview_secret?.trim() ?? null;
    const useConceptPreviewUrl = status === "draft" || status === "paused";
    if (useConceptPreviewUrl && !secret) {
      secret = (await ensureClientPreviewSecretBySlug(slug))?.trim() ?? null;
    }
    const previewAbsolute =
      useConceptPreviewUrl && secret
        ? `${base}/site/${enc}?token=${encodeURIComponent(secret)}`
        : null;

    return { status, liveAbsolute, previewAbsolute };
  } catch {
    return null;
  }
}

/**
 * Absolute URL voor **Site** in nieuw tabblad vanuit de admin:
 * - `active` → publieke live site `/site/{slug}`.
 * - `draft` / `paused` → `/site/{slug}?token=…` wanneer `preview_secret` beschikbaar is (deelbare conceptweergave).
 * - Anders (o.a. `archived` of ontbrekende kolom) → `/site/{slug}` zonder token (kan 404 zijn).
 */
export async function resolveSiteOpenAbsoluteUrlForAdmin(
  slug: string,
  status: ClientStatus,
  origin: string | null,
): Promise<string> {
  const base = (origin ?? "").replace(/\/$/, "");
  const enc = encodeURIComponent(slug);
  const liveAbsolute = `${base}/site/${enc}`;
  if (status === "active") {
    return liveAbsolute;
  }
  const urls = await getClientSiteUrlsForAdminDossier(slug, origin);
  if (urls?.previewAbsolute) {
    return urls.previewAbsolute;
  }
  return liveAbsolute;
}
