/**
 * Supabase Storage `upload({ cacheControl })` — seconden als string.
 * Zonder dit gebruikt het platform vaak **3600** (1 uur) → Lighthouse “efficient cache lifetime”.
 * Publieke site-assets krijgen unieke paden (`timestamp-random-…`); lang cachen is veilig.
 */
export const SITE_ASSETS_UPLOAD_CACHE_CONTROL_MAX_AGE = "31536000";
