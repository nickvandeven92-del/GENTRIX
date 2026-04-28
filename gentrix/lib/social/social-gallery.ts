import { z } from "zod";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

export const socialProviderSchema = z.enum(["instagram", "facebook"]);
export type SocialProvider = z.infer<typeof socialProviderSchema>;
export const socialGalleryLayoutSchema = z.enum(["carousel", "grid"]);
export type SocialGalleryLayout = z.infer<typeof socialGalleryLayoutSchema>;

export const socialGalleryItemSchema = z.object({
  id: z.string().min(1).max(120),
  url: z.string().url().max(1200),
  caption: z.string().max(1200).optional(),
  permalink: z.string().url().max(1200).optional(),
  timestamp: z.string().max(120).optional(),
});
export type SocialGalleryItem = z.infer<typeof socialGalleryItemSchema>;

export const socialGallerySettingsSchema = z.object({
  customerOptIn: z.boolean().default(true),
  enabled: z.boolean().default(false),
  layout: socialGalleryLayoutSchema.default("carousel"),
  provider: socialProviderSchema.default("instagram"),
  accountId: z.string().max(180).optional(),
  accountHandle: z.string().max(180).optional(),
  accessToken: z.string().max(3000).optional(),
  accessTokenEncrypted: z.string().max(6000).optional(),
  lastSyncAt: z.string().datetime().optional(),
  lastSyncStatus: z.string().max(400).optional(),
});
export type SocialGallerySettings = z.infer<typeof socialGallerySettingsSchema>;

export function parseSocialGallerySettings(input: unknown): SocialGallerySettings {
  const parsed = socialGallerySettingsSchema.safeParse(input);
  return parsed.success ? parsed.data : socialGallerySettingsSchema.parse({});
}

export function parseSocialGalleryItems(input: unknown): SocialGalleryItem[] {
  const parsed = z.array(socialGalleryItemSchema).max(9).safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.slice(0, 9);
}

type SyncInput = {
  provider: SocialProvider;
  accessToken: string;
  accountId: string;
};

type SyncResult =
  | { ok: true; items: SocialGalleryItem[]; status: string; syncedAt: string }
  | { ok: false; status: string };

function normalizeInstagramPayload(json: unknown): SocialGalleryItem[] {
  const rows = z
    .object({
      data: z
        .array(
          z.object({
            id: z.string(),
            media_type: z.string().optional(),
            media_url: z.string().url().optional(),
            thumbnail_url: z.string().url().optional(),
            caption: z.string().optional(),
            permalink: z.string().url().optional(),
            timestamp: z.string().optional(),
          }),
        )
        .default([]),
    })
    .safeParse(json);
  if (!rows.success) return [];
  return rows.data.data
    .reduce<SocialGalleryItem[]>((acc, row) => {
      const url = row.media_url ?? row.thumbnail_url;
      if (!url) return acc;
      acc.push({
        id: row.id,
        url,
        caption: row.caption,
        permalink: row.permalink,
        timestamp: row.timestamp,
      });
      return acc;
    }, [])
    .slice(0, 9);
}

function normalizeFacebookPayload(json: unknown): SocialGalleryItem[] {
  const rows = z
    .object({
      data: z
        .array(
          z.object({
            id: z.string(),
            images: z.array(z.object({ source: z.string().url() })).optional(),
            name: z.string().optional(),
            link: z.string().url().optional(),
            created_time: z.string().optional(),
          }),
        )
        .default([]),
    })
    .safeParse(json);
  if (!rows.success) return [];
  return rows.data.data
    .reduce<SocialGalleryItem[]>((acc, row) => {
      const img = row.images?.[0]?.source;
      if (!img) return acc;
      acc.push({
        id: row.id,
        url: img,
        caption: row.name,
        permalink: row.link,
        timestamp: row.created_time,
      });
      return acc;
    }, [])
    .slice(0, 9);
}

export async function syncSocialGalleryFeed(input: SyncInput): Promise<SyncResult> {
  const accessToken = input.accessToken.trim();
  const accountId = input.accountId.trim();
  if (!accessToken || !accountId) {
    return { ok: false, status: "Koppel eerst account-id en token." };
  }

  const endpoint =
    input.provider === "instagram"
      ? `https://graph.facebook.com/v20.0/${encodeURIComponent(accountId)}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,media_type&limit=9&access_token=${encodeURIComponent(accessToken)}`
      : `https://graph.facebook.com/v20.0/${encodeURIComponent(accountId)}/photos?type=uploaded&fields=id,images,link,name,created_time&limit=9&access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetchWithTimeout(endpoint, { timeoutMs: 10_000, cache: "no-store" });
    if (!res.ok) {
      return { ok: false, status: `Sync mislukt (${res.status}).` };
    }
    const json: unknown = await res.json();
    const items =
      input.provider === "instagram" ? normalizeInstagramPayload(json) : normalizeFacebookPayload(json);
    if (items.length === 0) {
      return { ok: false, status: "Geen bruikbare foto's gevonden." };
    }
    return {
      ok: true,
      items,
      status: `Sync voltooid (${items.length} foto's).`,
      syncedAt: new Date().toISOString(),
    };
  } catch {
    return { ok: false, status: "Social sync timeout of netwerkfout." };
  }
}
