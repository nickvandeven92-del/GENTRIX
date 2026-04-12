import { ensureClientFlyerPublicTokenBySlug } from "@/lib/data/ensure-client-flyer-token";
import { ensureClientPreviewSecretBySlug } from "@/lib/data/ensure-client-preview-secret";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import type { ClientStatus } from "@/lib/types/database";

/** Zelfde basis als PDF-routes: request-host, anders `NEXT_PUBLIC_SITE_URL` / Vercel. */
export function resolvePublicBase(origin: string | null | undefined): string {
  const trimmed = origin?.trim() ?? "";
  const raw = trimmed.length > 0 ? trimmed : getPublicAppUrl();
  return raw.replace(/\/$/, "");
}

export type ClientSiteUrlsForAdmin = {
  status: ClientStatus;
  /** Absolute URL naar definitieve live site (/site/{slug}). */
  liveAbsolute: string;
  /** Bij concept of gepauzeerd + preview_secret: URL met token. */
  previewAbsolute: string | null;
  /** Korte flyer/QR-link (`/p/{uuid}`); concept → preview+walkthrough, live → site. */
  flyerQrAbsolute: string | null;
};

/**
 * Bepaalt welke publieke URLs relevant zijn voor het dossier (admin).
 * Live is alleen zichtbaar voor bezoekers als status === active (en inhoud gepubliceerd).
 */
export async function getClientSiteUrlsForAdminDossier(
  slug: string,
  origin: string | null,
): Promise<ClientSiteUrlsForAdmin | null> {
  const base = resolvePublicBase(origin);
  const enc = encodeURIComponent(slug);
  const liveAbsolute = `${base}/site/${enc}`;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("status, preview_secret, flyer_public_token")
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
        flyerQrAbsolute: null,
      };
    }

    if (error && isPostgrestUnknownColumnError(error, "flyer_public_token")) {
      const second = await supabase
        .from("clients")
        .select("status, preview_secret")
        .eq("subfolder_slug", slug)
        .maybeSingle();
      if (second.error || !second.data) return null;
      const status = second.data.status as ClientStatus;
      let secret = (second.data as { preview_secret?: string | null }).preview_secret?.trim() ?? null;
      const useConceptPreviewUrl = status === "draft" || status === "paused" || status === "archived";
      if (useConceptPreviewUrl && !secret) {
        secret = (await ensureClientPreviewSecretBySlug(slug))?.trim() ?? null;
      }
      const previewAbsolute =
        useConceptPreviewUrl && secret
          ? `${base}/site/${enc}?token=${encodeURIComponent(secret)}`
          : null;
      return { status, liveAbsolute, previewAbsolute, flyerQrAbsolute: null };
    }

    if (error || !data) return null;

    const status = data.status as ClientStatus;
    let secret = (data as { preview_secret?: string | null }).preview_secret?.trim() ?? null;
    const useConceptPreviewUrl = status === "draft" || status === "paused" || status === "archived";
    if (useConceptPreviewUrl && !secret) {
      secret = (await ensureClientPreviewSecretBySlug(slug))?.trim() ?? null;
    }
    const previewAbsolute =
      useConceptPreviewUrl && secret
        ? `${base}/site/${enc}?token=${encodeURIComponent(secret)}`
        : null;

    let flyerTok = (data as { flyer_public_token?: string | null }).flyer_public_token?.trim() ?? null;
    if (!flyerTok) {
      flyerTok = (await ensureClientFlyerPublicTokenBySlug(slug))?.trim() ?? null;
    }
    const flyerQrAbsolute = flyerTok ? `${base}/p/${encodeURIComponent(flyerTok)}` : null;

    return { status, liveAbsolute, previewAbsolute, flyerQrAbsolute };
  } catch {
    return null;
  }
}

/**
 * Absolute URL voor **Site** in nieuw tabblad vanuit de admin.
 * Status komt uit **de database** (service role), niet alleen uit de UI-hint — anders opent een concept
 * soms per ongeluk `/site/…` zonder `?token=` en krijg je 404.
 */
export async function resolveSiteOpenAbsoluteUrlForAdmin(
  slug: string,
  statusHint: ClientStatus,
  origin: string | null,
): Promise<string> {
  const base = resolvePublicBase(origin);
  const enc = encodeURIComponent(slug);
  const liveAbsolute = `${base}/site/${enc}`;

  let urls: ClientSiteUrlsForAdmin | null = null;
  try {
    urls = await getClientSiteUrlsForAdminDossier(slug, origin);
  } catch {
    urls = null;
  }

  const effectiveStatus: ClientStatus = urls?.status ?? statusHint;

  if (effectiveStatus === "active") {
    return liveAbsolute;
  }

  if (urls?.previewAbsolute) {
    return urls.previewAbsolute;
  }

  const needsPreviewToken =
    effectiveStatus === "draft" ||
    effectiveStatus === "paused" ||
    effectiveStatus === "archived";

  if (needsPreviewToken) {
    const secret = (await ensureClientPreviewSecretBySlug(slug))?.trim() ?? null;
    if (secret) {
      return `${base}/site/${enc}?token=${encodeURIComponent(secret)}`;
    }
  }

  return liveAbsolute;
}
