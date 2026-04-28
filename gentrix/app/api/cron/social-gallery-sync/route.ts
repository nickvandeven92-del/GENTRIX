import { NextResponse } from "next/server";
import { parseSocialGallerySettings, syncSocialGalleryFeed } from "@/lib/social/social-gallery";
import { decryptSocialToken } from "@/lib/social/social-gallery-secrets";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type ClientRow = {
  id: string;
  social_gallery_settings?: unknown;
};

function positiveIntFromEnv(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * Periodieke background-sync van social gallery items voor actieve klanten.
 * Beveiliging: Authorization: Bearer $CRON_SECRET (Vercel Cron).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor")?.trim() ?? "";
  const batchSize = positiveIntFromEnv("SOCIAL_GALLERY_CRON_BATCH_SIZE", 60, 300);
  const maxSyncs = positiveIntFromEnv("SOCIAL_GALLERY_CRON_MAX_SYNCS", 40, 200);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from("clients")
    .select("id, social_gallery_settings")
    .eq("status", "active")
    .order("id", { ascending: true })
    .limit(batchSize);
  if (cursor) {
    query = query.gt("id", cursor);
  }
  const { data, error } = (await query) as { data: ClientRow[] | null; error: { message: string } | null };

  if (error) {
    if (isPostgrestUnknownColumnError(error, "social_gallery_settings")) {
      return NextResponse.json(
        { ok: false, error: "Migratie ontbreekt: voer 20260428193000_clients_social_gallery.sql uit." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const nextCursor = rows.length === batchSize ? rows[rows.length - 1]?.id ?? null : null;
  let candidates = 0;
  let synced = 0;
  let failed = 0;
  let skippedByRunLimit = 0;

  for (const row of rows) {
    if (synced + failed >= maxSyncs) {
      skippedByRunLimit += 1;
      continue;
    }
    const settings = parseSocialGallerySettings(row.social_gallery_settings);
    if (settings.customerOptIn === false || !settings.enabled || !settings.accountId?.trim()) continue;
    const token = decryptSocialToken(settings.accessTokenEncrypted) ?? settings.accessToken ?? "";
    if (!token.trim()) continue;
    candidates += 1;

    const sync = await syncSocialGalleryFeed({
      provider: settings.provider,
      accountId: settings.accountId,
      accessToken: token,
    });

    if (!sync.ok) {
      failed += 1;
      await supabase
        .from("clients")
        .update({
          social_gallery_settings: {
            ...settings,
            accessToken: undefined,
            lastSyncStatus: sync.status,
          },
        })
        .eq("id", row.id);
      continue;
    }

    synced += 1;
    await supabase
      .from("clients")
      .update({
        social_gallery_settings: {
          ...settings,
          accessToken: undefined,
          lastSyncAt: sync.syncedAt,
          lastSyncStatus: sync.status,
        },
        social_gallery_items: sync.items,
      })
      .eq("id", row.id);
  }

  return NextResponse.json({
    ok: true,
    checkedActiveClients: rows.length,
    batchSize,
    maxSyncs,
    cursor: cursor || null,
    nextCursor,
    candidates,
    synced,
    failed,
    skippedByRunLimit,
  });
}
