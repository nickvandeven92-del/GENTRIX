import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import {
  parseSocialGalleryItems,
  parseSocialGallerySettings,
  syncSocialGalleryFeed,
  type SocialGalleryItem,
  type SocialGallerySettings,
} from "@/lib/social/social-gallery";
import { decryptSocialToken } from "@/lib/social/social-gallery-secrets";

export type PublicSocialGallery = {
  enabled: boolean;
  items: SocialGalleryItem[];
};

type SocialCols = {
  id: string;
  social_gallery_settings?: unknown;
  social_gallery_items?: unknown;
};

function canAutoSync(settings: SocialGallerySettings): boolean {
  if (settings.customerOptIn === false) return false;
  if (!settings.enabled) return false;
  if (!settings.accountId?.trim()) return false;
  if (!decryptSocialToken(settings.accessTokenEncrypted) && !settings.accessToken?.trim()) return false;
  if (!settings.lastSyncAt) return true;
  const last = Date.parse(settings.lastSyncAt);
  if (!Number.isFinite(last)) return true;
  return Date.now() - last > 10 * 60_000;
}

export async function loadPublicSocialGalleryBySlug(slug: string): Promise<PublicSocialGallery | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("id, social_gallery_settings, social_gallery_items")
      .eq("subfolder_slug", slug)
      .eq("status", "active")
      .maybeSingle<SocialCols>();
    if (error) {
      if (
        isPostgrestUnknownColumnError(error, "social_gallery_settings") ||
        isPostgrestUnknownColumnError(error, "social_gallery_items")
      ) {
        return null;
      }
      return null;
    }
    if (!data) return null;

    let settings = parseSocialGallerySettings(data.social_gallery_settings);
    let items = parseSocialGalleryItems(data.social_gallery_items);
    const resolvedToken = decryptSocialToken(settings.accessTokenEncrypted) ?? settings.accessToken ?? "";

    if (canAutoSync(settings)) {
      const sync = await syncSocialGalleryFeed({
        provider: settings.provider,
        accountId: settings.accountId ?? "",
        accessToken: resolvedToken,
      });
      if (sync.ok) {
        items = sync.items;
        settings = { ...settings, lastSyncAt: sync.syncedAt, lastSyncStatus: sync.status };
        await supabase
          .from("clients")
          .update({
            social_gallery_settings: settings,
            social_gallery_items: items,
          })
          .eq("id", data.id);
      } else {
        settings = { ...settings, lastSyncStatus: sync.status };
        await supabase
          .from("clients")
          .update({
            social_gallery_settings: settings,
          })
          .eq("id", data.id);
      }
    }

    if (!settings.enabled || settings.customerOptIn === false || items.length === 0) {
      return { enabled: Boolean(settings.enabled), items: [] };
    }
    return { enabled: true, items: items.slice(0, 9) };
  } catch {
    return null;
  }
}
