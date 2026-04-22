import { requireAdminApiAuth, type AdminAuthResult } from "@/lib/auth/require-admin-api";
import {
  getStudioAdminUserIds,
  isStudioAdminStrictModeEnabled,
  isStudioAdminUserId,
} from "@/lib/auth/studio-admin-users";

export type StudioAdminAuthResult = AdminAuthResult;

/**
 * Strikte admin-gate voor endpoints die willekeurige tenants kunnen muteren
 * (bulk-delete, billing, sales-os, invoices/quotes, etc.).
 *
 * - Eerst de reguliere auth-keten (login + MFA).
 * - Daarna: moet in `STUDIO_ADMIN_USER_IDS` (of `PORTAL_STUDIO_PREVIEW_USER_IDS`) staan.
 *
 * In dev/preview zonder env-setup is dit fail-open zodat lokaal werken niet breekt —
 * zie `isStudioAdminStrictModeEnabled()`.
 */
export async function requireStudioAdminApiAuth(): Promise<StudioAdminAuthResult> {
  const base = await requireAdminApiAuth();
  if (!base.ok) return base;

  const adminIds = getStudioAdminUserIds();
  if (isStudioAdminUserId(base.userId)) return base;

  if (adminIds.length === 0 && !isStudioAdminStrictModeEnabled()) {
    // Dev/preview zonder lijst → behoud huidige soepele gedrag.
    return base;
  }

  return {
    ok: false,
    status: 403,
    message:
      "Geen studio-admin rechten. Neem contact op met de studio-eigenaar (configuratie: STUDIO_ADMIN_USER_IDS).",
  };
}
