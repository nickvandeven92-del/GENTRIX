import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  parseSocialGalleryItems,
  parseSocialGallerySettings,
  socialGalleryItemSchema,
  socialGallerySettingsSchema,
  syncSocialGalleryFeed,
} from "@/lib/social/social-gallery";
import { z } from "zod";
import { decryptSocialToken, encryptSocialToken } from "@/lib/social/social-gallery-secrets";

type RouteContext = { params: Promise<{ slug: string }> };
type PublicSettings = ReturnType<typeof toPublicSettings>;

const patchSchema = socialGallerySettingsSchema
  .pick({
    enabled: true,
    layout: true,
    provider: true,
    accountId: true,
    accountHandle: true,
    accessToken: true,
  })
  .partial();

const patchBodySchema = z
  .object({
    settings: patchSchema.optional(),
    items: z.array(socialGalleryItemSchema).max(9).optional(),
  })
  .strict();

function toPublicSettings(settings: ReturnType<typeof parseSocialGallerySettings>) {
  const hasToken = Boolean(
    decryptSocialToken(settings.accessTokenEncrypted) || settings.accessToken?.trim(),
  );
  return {
    customerOptIn: settings.customerOptIn !== false,
    enabled: settings.enabled,
    layout: settings.layout,
    provider: settings.provider,
    accountId: settings.accountId ?? "",
    accountHandle: settings.accountHandle ?? "",
    hasToken,
    lastSyncAt: settings.lastSyncAt,
    lastSyncStatus: settings.lastSyncStatus,
  };
}

async function resolveAccess(context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) return { ok: false as const, response: NextResponse.json({ ok: false, error: access.message }, { status: access.status }) };
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) return { ok: false as const, response: NextResponse.json({ ok: false, error: resolved.error }, { status: 404 }) };
  return { ok: true as const, slug, userId: access.userId, clientId: resolved.clientId };
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:social-gallery:get:${auth.slug}`, 120)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("social_gallery_settings, social_gallery_items")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (error) {
      if (
        isPostgrestUnknownColumnError(error, "social_gallery_settings") ||
        isPostgrestUnknownColumnError(error, "social_gallery_items")
      ) {
        return NextResponse.json(
          { ok: false, error: "Migratie ontbreekt: voer social gallery migratie uit." },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const settings = parseSocialGallerySettings(data?.social_gallery_settings);
    const items = parseSocialGalleryItems(data?.social_gallery_items);
    const publicSettings: PublicSettings = toPublicSettings(settings);
    return NextResponse.json({ ok: true, settings: publicSettings, items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Onbekende fout" }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:social-gallery:patch:${auth.slug}`, 60)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON." }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data: existingData, error: existingErr } = await supabase
      .from("clients")
      .select("social_gallery_settings")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (existingErr) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }
    const existing = parseSocialGallerySettings(existingData?.social_gallery_settings);
    const incomingSettings = parsed.data.settings ?? {};
    const incomingItems = parsed.data.items;
    const hasAccessTokenInput = typeof incomingSettings.accessToken === "string";
    const encryptedFromInput =
      hasAccessTokenInput && incomingSettings.accessToken.trim() !== ""
        ? encryptSocialToken(incomingSettings.accessToken)
        : null;
    const settings = {
      ...existing,
      ...incomingSettings,
      accessToken: undefined,
      accessTokenEncrypted: hasAccessTokenInput
        ? (encryptedFromInput ?? undefined)
        : existing.accessTokenEncrypted,
    };
    const updates: {
      social_gallery_settings: typeof settings;
      social_gallery_items?: ReturnType<typeof parseSocialGalleryItems>;
    } = {
      social_gallery_settings: settings,
    };
    if (incomingItems) {
      updates.social_gallery_items = parseSocialGalleryItems(incomingItems);
    }
    const { error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", auth.clientId);
    if (error) {
      if (isPostgrestUnknownColumnError(error, "social_gallery_settings")) {
        return NextResponse.json({ ok: false, error: "Migratie ontbreekt: voer social gallery migratie uit." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      settings: toPublicSettings(settings),
      items: updates.social_gallery_items,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Onbekende fout" }, { status: 503 });
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const auth = await resolveAccess(context);
  if (!auth.ok) return auth.response;
  if (!checkPortalRateLimit(auth.userId, `portal:social-gallery:sync:${auth.slug}`, 20)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("clients")
      .select("social_gallery_settings")
      .eq("id", auth.clientId)
      .maybeSingle();
    if (error) {
      if (isPostgrestUnknownColumnError(error, "social_gallery_settings")) {
        return NextResponse.json({ ok: false, error: "Migratie ontbreekt: voer social gallery migratie uit." }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const settings = parseSocialGallerySettings(data?.social_gallery_settings);
    const resolvedToken =
      decryptSocialToken(settings.accessTokenEncrypted) ?? settings.accessToken ?? "";
    const sync = await syncSocialGalleryFeed({
      provider: settings.provider,
      accountId: settings.accountId ?? "",
      accessToken: resolvedToken,
    });
    if (!sync.ok) {
      const failed = { ...settings, lastSyncStatus: sync.status };
      await supabase.from("clients").update({ social_gallery_settings: failed }).eq("id", auth.clientId);
      return NextResponse.json({ ok: false, error: sync.status }, { status: 400 });
    }
    const nextSettings = {
      ...settings,
      accessToken: undefined,
      lastSyncAt: sync.syncedAt,
      lastSyncStatus: sync.status,
    };
    const { error: upErr } = await supabase
      .from("clients")
      .update({
        social_gallery_settings: nextSettings,
        social_gallery_items: sync.items,
      })
      .eq("id", auth.clientId);
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, settings: toPublicSettings(nextSettings), items: sync.items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Onbekende fout" }, { status: 503 });
  }
}
