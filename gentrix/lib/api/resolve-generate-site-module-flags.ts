import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { isValidSubfolderSlug } from "@/lib/slug";

export type GenerateSiteModuleFlagsInput = {
  subfolder_slug?: string | null;
  appointments_enabled?: boolean;
  webshop_enabled?: boolean;
};

/**
 * Bron: bij geldige klant-slug altijd CRM (`clients`); anders optionele booleans uit de request-body
 * (studio zonder persisted slug, tests).
 */
export async function resolveGenerateSiteModuleFlags(
  input: GenerateSiteModuleFlagsInput,
): Promise<{ appointmentsEnabled: boolean; webshopEnabled: boolean }> {
  const slug = typeof input.subfolder_slug === "string" ? input.subfolder_slug.trim() : "";
  if (slug && isValidSubfolderSlug(slug)) {
    const row = await getClientCommercialBySlug(slug);
    if (row) {
      return {
        appointmentsEnabled: Boolean(row.appointments_enabled),
        webshopEnabled: Boolean(row.webshop_enabled),
      };
    }
  }
  return {
    appointmentsEnabled: input.appointments_enabled === true,
    webshopEnabled: input.webshop_enabled === true,
  };
}
