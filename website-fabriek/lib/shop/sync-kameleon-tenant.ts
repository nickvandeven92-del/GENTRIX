import { createKameleonServiceClient } from "@/lib/shop/kameleon-service-client";

export type KameleonShopSyncResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; upserted: true }
  | { ok: false; error: string };

const SHOP_NAME_MAX = 200;

function trimShopName(name: string, fallbackSlug: string): string {
  const n = name.trim() || fallbackSlug;
  return n.length > SHOP_NAME_MAX ? n.slice(0, SHOP_NAME_MAX) : n;
}

/**
 * Houdt één Chameleon-tenant per studio-klant: `clients.slug` = studio `subfolder_slug`.
 * Zonder env-vars: no-op (studio blijft werken; handmatig sync blijft mogelijk).
 */
export async function syncKameleonShopTenant(opts: {
  subfolderSlug: string;
  displayName: string;
  webshopEnabled: boolean;
}): Promise<KameleonShopSyncResult> {
  const shop = createKameleonServiceClient();
  if (!shop) {
    return {
      ok: true,
      skipped: true,
      reason:
        "Geen Supabase-serviceclient: zet SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL, of KAMELEON_* voor een apart shop-project.",
    };
  }

  const slug = opts.subfolderSlug.trim();
  const name = trimShopName(opts.displayName, slug);
  const shopName = name;

  const row = {
    slug,
    name,
    shop_name: shopName,
    webshop_enabled: opts.webshopEnabled,
  };

  const { error } = await shop.from("clients").upsert(row, { onConflict: "slug" });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return { ok: true, upserted: true };
}
