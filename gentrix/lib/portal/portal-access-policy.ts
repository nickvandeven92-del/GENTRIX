/**
 * Centraal beleid voor wie een klantportaal (pagina’s + /api/portal/*) mag gebruiken.
 *
 * - **Strikt (aanbevolen productie):** alleen `portal_user_id` match, plus optioneel studio-UUID’s.
 * - **Strikt aan:** `PORTAL_STRICT_ACCESS=1`, of automatisch wanneer `NODE_ENV=production` (tenzij `PORTAL_STRICT_ACCESS=0`).
 * - **Strikt uit:** `PORTAL_STRICT_ACCESS=0` (ook in productie; alleen voor nood-debug).
 */

export function isPortalStrictAccessEnabled(): boolean {
  if (process.env.PORTAL_STRICT_ACCESS === "1") return true;
  if (process.env.PORTAL_STRICT_ACCESS === "0") return false;
  return process.env.NODE_ENV === "production";
}

/**
 * Studio/medewerker mag portaal-API’s aanroepen zonder `portal_user_id`-koppeling
 * (preview / support), of iedereen mag dat als strikte modus uit staat.
 */
export function userMayActAsStudioForPortalApis(userId: string): boolean {
  const raw = process.env.PORTAL_STUDIO_PREVIEW_USER_IDS?.trim();
  if (raw) {
    const allowed = new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    if (allowed.has(userId)) return true;
  }
  if (!isPortalStrictAccessEnabled()) return true;
  return false;
}
