import { z } from "zod";
import {
  tailwindPageConfigSchema,
  tailwindSectionSchema,
  type TailwindSectionsPayload,
} from "@/lib/ai/tailwind-sections-schema";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import type { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Json } from "@/lib/types/database";
import type { PortalThemePresetId } from "@/lib/portal/restyle-site-theme";

/**
 * Cache voor thema-varianten per klant (kolom `clients.theme_variants`).
 *
 * Waarom: zonder cache raakt de "origineel"-baseline verloren zodra de server de draft overschrijft
 * met een Dark/Warm variant — de volgende page-load heeft dan alleen nog de getransformeerde versie.
 * Met cache bewaren we:
 *   - `variants.original`: de site v??r er ??berhaupt een thema is toegepast (of de laatst-bewerkte
 *     versie terwijl de gebruiker op "origineel" stond).
 *   - `variants.dark` / `variants.warm`: de Claude-getransformeerde varianten ??? her te gebruiken
 *     zodat terug-schakelen geen AI-call vereist.
 *
 * De cache is tolerant voor een ontbrekende kolom (pre-migration): alles valt terug op het oude
 * AI-elke-keer gedrag. De schema-validatie verwerpt stille corruptie, zodat een half-ingevulde JSON
 * niet onopgemerkt doorstroomt.
 */

// Losser dan `tailwindSectionsPayloadSchema`: de cache bewaart expres zonder `format`-discriminator,
// en tailwindSectionsPayloadSchema.preprocess strippt keys die we hier juist willen behouden.
const cachedPayloadSchema = z.object({
  config: tailwindPageConfigSchema,
  sections: z.array(tailwindSectionSchema).min(1),
  contactSections: z.array(tailwindSectionSchema).optional(),
  marketingPages: z.record(z.string().min(1), z.array(tailwindSectionSchema).min(1)).optional(),
  documentTitle: z.string().min(1).optional(),
});

export type CachedThemePayload = z.infer<typeof cachedPayloadSchema>;

const themePresetIdSchema = z.enum(["original", "dark", "warm"]) satisfies z.ZodType<PortalThemePresetId>;

const themeVariantsSchema = z.object({
  active: themePresetIdSchema.optional(),
  variants: z
    .object({
      original: cachedPayloadSchema.optional(),
      dark: cachedPayloadSchema.optional(),
      warm: cachedPayloadSchema.optional(),
    })
    .default({}),
});

export type ThemeVariantsCache = z.infer<typeof themeVariantsSchema>;

type SupabaseAny = ReturnType<typeof createServiceRoleClient>;

/**
 * Leest de cache uit `clients.theme_variants`. Retourneert `null` bij onbekende kolom (oude DB)
 * zodat callers stil kunnen terugvallen. Retourneert een leeg object bij ontbrekende/corrupt JSON.
 */
export async function readThemeVariantsCache(
  supabase: SupabaseAny,
  clientId: string,
): Promise<{ supported: false } | { supported: true; cache: ThemeVariantsCache }> {
  const res = await supabase
    .from("clients")
    .select("theme_variants")
    .eq("id", clientId)
    .maybeSingle();

  if (res.error) {
    if (isPostgrestUnknownColumnError(res.error, "theme_variants")) {
      return { supported: false };
    }
    return { supported: true, cache: { variants: {} } };
  }

  const raw = (res.data as { theme_variants?: Json | null } | null)?.theme_variants ?? null;
  if (raw == null) return { supported: true, cache: { variants: {} } };

  const parsed = themeVariantsSchema.safeParse(raw);
  if (!parsed.success) {
    return { supported: true, cache: { variants: {} } };
  }
  return { supported: true, cache: parsed.data };
}

export async function writeThemeVariantsCache(
  supabase: SupabaseAny,
  clientId: string,
  cache: ThemeVariantsCache,
): Promise<{ ok: true } | { ok: false; error: string; unsupported?: boolean }> {
  const { error } = await supabase
    .from("clients")
    .update({ theme_variants: cache as unknown as Json })
    .eq("id", clientId);

  if (error) {
    if (isPostgrestUnknownColumnError(error, "theme_variants")) {
      return { ok: false, error: error.message, unsupported: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function payloadToCached(payload: TailwindSectionsPayload, documentTitle?: string): CachedThemePayload {
  if (!payload.config) {
    // Zou nooit mogen voorkomen in thema-flows: alle payloads die hier binnenkomen zijn master-format
    // met een expliciete pageConfig. Gooi een duidelijke fout i.p.v. stil corrupt cachen.
    throw new Error("payloadToCached: payload.config ontbreekt; master-format vereist.");
  }
  const entry: CachedThemePayload = {
    config: payload.config,
    sections: payload.sections,
    ...(payload.contactSections && payload.contactSections.length > 0
      ? { contactSections: payload.contactSections }
      : {}),
    ...(payload.marketingPages && Object.keys(payload.marketingPages).length > 0
      ? { marketingPages: payload.marketingPages }
      : {}),
    ...(documentTitle && documentTitle.trim() ? { documentTitle: documentTitle.trim() } : {}),
  };
  return entry;
}

export function cachedToPayload(cached: CachedThemePayload): TailwindSectionsPayload {
  return {
    format: "tailwind_sections",
    config: cached.config,
    sections: cached.sections,
    ...(cached.contactSections ? { contactSections: cached.contactSections } : {}),
    ...(cached.marketingPages ? { marketingPages: cached.marketingPages } : {}),
  } as TailwindSectionsPayload;
}

/**
 * Update de cache-variant voor de momenteel actieve preset na een handmatige save.
 * Wanneer `active === "original"` wissen we dark/warm: die waren afgeleid van een oudere baseline
 * en zijn na een content-wijziging niet meer representatief. Wanneer `active` een getransformeerde
 * preset is (dark/warm), laten we `original` en de andere preset met rust: de user bewerkt bewust
 * alleen deze variant. Dat houdt de "ping-pong"-UX betrouwbaar.
 */
export function applyActiveVariantSync(
  cache: ThemeVariantsCache,
  activeId: PortalThemePresetId,
  payload: CachedThemePayload,
): ThemeVariantsCache {
  const nextVariants: ThemeVariantsCache["variants"] = { ...cache.variants, [activeId]: payload };
  if (activeId === "original") {
    delete nextVariants.dark;
    delete nextVariants.warm;
  }
  return { active: activeId, variants: nextVariants };
}
