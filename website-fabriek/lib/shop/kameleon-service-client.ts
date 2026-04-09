import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-client voor shop-sync (Chameleon `clients.slug` ↔ studio `subfolder_slug`).
 *
 * - **Zelfde project als studio** (boeking + CRM + webshop op één Supabase): laat `KAMELEON_*` leeg;
 *   dan vallen we terug op `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
 * - **Aparte shop-database**: zet `KAMELEON_SUPABASE_URL` + `KAMELEON_SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createKameleonServiceClient(): SupabaseClient | null {
  const urlDedicated =
    process.env.KAMELEON_SUPABASE_URL?.trim() ||
    process.env.CHAMELEON_SUPABASE_URL?.trim() ||
    "";
  const keyDedicated =
    process.env.KAMELEON_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CHAMELEON_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  const url = urlDedicated || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key = keyDedicated || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
