/**
 * Premium logo-pipeline: extra Claude-call vóór site-generatie.
 * Zet `ENABLE_BRAND_LOGO_SYSTEM=1` in `.env.local` om te activeren.
 */
export function isBrandLogoSystemEnabled(): boolean {
  const v = process.env.ENABLE_BRAND_LOGO_SYSTEM?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
