/**
 * Lijst van Supabase Auth-user-UUID's die als "studio admin" mogen handelen op alle tenants.
 *
 * Bron:
 *   1) `STUDIO_ADMIN_USER_IDS` (komma-gescheiden) — aanbevolen naam.
 *   2) Terugval op `PORTAL_STUDIO_PREVIEW_USER_IDS` (historische variabele, zelfde semantiek).
 *
 * Lege lijst in **productie** = fail-closed voor studio-admin routes (zie `require-studio-admin-api.ts`).
 * Lege lijst in **development/preview** = fail-open (voor lokaal werken zonder env-setup).
 */

let cached: readonly string[] | null = null;
let cachedSignature: string | null = null;

function readRaw(): string {
  return (
    process.env.STUDIO_ADMIN_USER_IDS?.trim() ||
    process.env.PORTAL_STUDIO_PREVIEW_USER_IDS?.trim() ||
    ""
  );
}

export function getStudioAdminUserIds(): readonly string[] {
  const raw = readRaw();
  if (cached && cachedSignature === raw) return cached;
  const parsed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  cached = Object.freeze(parsed);
  cachedSignature = raw;
  return cached;
}

export function isStudioAdminUserId(userId: string): boolean {
  if (!userId) return false;
  const list = getStudioAdminUserIds();
  return list.includes(userId);
}

/**
 * Strikte modus: `STUDIO_ADMIN_STRICT=1` forceert, `=0` schakelt expliciet uit.
 * Zonder expliciete waarde: strikt in productie, soepel in dev/preview.
 */
export function isStudioAdminStrictModeEnabled(): boolean {
  const raw = process.env.STUDIO_ADMIN_STRICT?.trim();
  if (raw === "1") return true;
  if (raw === "0") return false;
  return process.env.NODE_ENV === "production";
}
