import type { TailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { readThemeVariantsCache } from "@/lib/portal/theme-variants-cache";

/**
 * Server-side helper: haalt `theme_variants.original.config` op voor een klant-slug.
 *
 * Wordt gebruikt in de portaal-website-pagina zodat de thema-swatches (Donker/Warm) altijd
 * worden afgeleid uit het onveranderde originele palet — ook wanneer de huidige draft al
 * getransformeerd is naar Donker of Warm (anders compound de swatch-berekening).
 *
 * Retourneert `null` wanneer:
 *  - de kolom nog niet gemigreerd is;
 *  - de klant nog geen cache-entry heeft (nog nooit een thema toegepast);
 *  - er niets te lezen valt.
 */
export async function readOriginalPageConfigForSlug(slug: string): Promise<TailwindPageConfig | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("subfolder_slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  const clientId = (data as { id: string }).id;

  const cache = await readThemeVariantsCache(supabase, clientId);
  if (!cache.supported) return null;
  return cache.cache.variants.original?.config ?? null;
}
