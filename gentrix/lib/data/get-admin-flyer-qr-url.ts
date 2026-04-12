import { ensureClientFlyerPublicTokenBySlug } from "@/lib/data/ensure-client-flyer-token";
import { resolvePublicBase } from "@/lib/data/client-preview-urls";

/**
 * Absolute `/p/{token}`-URL voor admin (Flyer & QR). Zelfde kern als repair-API: één pad, minder edge-cases
 * dan `getClientSiteUrlsForAdminDossier` (die soms `null` teruggeeft bij DB-/select-varianten).
 */
export async function getAdminFlyerQrAbsoluteUrl(subfolderSlug: string, origin: string | null): Promise<string | null> {
  const token = await ensureClientFlyerPublicTokenBySlug(subfolderSlug.trim());
  if (!token) return null;
  const base = resolvePublicBase(origin);
  return `${base}/p/${encodeURIComponent(token)}`;
}
