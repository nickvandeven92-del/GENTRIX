import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { parseSocialGallerySettings } from "@/lib/social/social-gallery";
import { encryptSocialToken } from "@/lib/social/social-gallery-secrets";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type RouteContext = { params: Promise<{ slug: string }> };
const COOKIE_NAME = "gentrix_social_oauth_state";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

type FbAccount = { id: string; name?: string; access_token?: string };
type IgPage = { access_token?: string; instagram_business_account?: { id?: string; username?: string } };

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const oauthError = url.searchParams.get("error") ?? "";
  const requestedProvider = state.startsWith("facebook:") ? "facebook" : "instagram";
  const fallbackRedirect = `/portal/${encodeURIComponent(slug)}/gallerij`;

  if (oauthError) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=denied`, request.url));
  }

  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=forbidden`, request.url));
  }
  if (!checkPortalRateLimit(access.userId, `portal:social-gallery:oauth:callback:${slug}`, 30)) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=rate_limited`, request.url));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(COOKIE_NAME)?.value ?? "";
  cookieStore.delete(COOKIE_NAME);
  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=state_error`, request.url));
  }

  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=missing_env`, request.url));
  }

  const origin = requestOrigin(request);
  const redirectUri = `${origin}/api/portal/clients/${encodeURIComponent(slug)}/social-gallery/oauth/callback`;

  try {
    const tokenRes = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
      { cache: "no-store", timeoutMs: 12_000 },
    );
    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=token_error`, request.url));
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const userToken = tokenJson.access_token?.trim() ?? "";
    if (!userToken) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=token_empty`, request.url));
    }

    let provider: "instagram" | "facebook" = requestedProvider;
    let accountId = "";
    let accountHandle = "";
    let accountToken = userToken;

    const igRes = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/me/accounts?fields=access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`,
      { cache: "no-store", timeoutMs: 12_000 },
    );
    const igJson = (await igRes.json()) as { data?: IgPage[] };
    const igFirst = igJson.data?.find((row) => row.instagram_business_account?.id && row.access_token);
    const igId = igFirst?.instagram_business_account?.id ?? "";
    const igUser = igFirst?.instagram_business_account?.username ?? "";
    const igToken = igFirst?.access_token ?? "";

    if (igId && igToken) {
      provider = "instagram";
      accountId = igId;
      accountHandle = igUser;
      accountToken = igToken;
    } else {
      const pagesRes = await fetchWithTimeout(
        `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(userToken)}`,
        { cache: "no-store", timeoutMs: 12_000 },
      );
      const pagesJson = (await pagesRes.json()) as { data?: FbAccount[] };
      const firstPage = pagesJson.data?.find((row) => row.id && row.access_token);
      if (!firstPage?.id || !firstPage.access_token) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=no_page`, request.url));
      }
      provider = "facebook";
      accountId = firstPage.id;
      accountHandle = firstPage.name ?? "";
      accountToken = firstPage.access_token;
    }

    const encrypted = encryptSocialToken(accountToken);
    if (!encrypted) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=crypto_error`, request.url));
    }

    const resolved = await resolveActivePortalClientIdBySlug(slug);
    if (!resolved.ok) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=no_client`, request.url));
    }
    const supabase = createServiceRoleClient();
    const { data: row } = await supabase
      .from("clients")
      .select("social_gallery_settings")
      .eq("id", resolved.clientId)
      .maybeSingle();
    const settings = parseSocialGallerySettings(row?.social_gallery_settings);
    const nextSettings = {
      ...settings,
      enabled: true,
      provider,
      accountId,
      accountHandle,
      accessToken: undefined,
      accessTokenEncrypted: encrypted,
      lastSyncStatus: "OAuth gekoppeld. Klik op 'Nu syncen'.",
    };
    await supabase.from("clients").update({ social_gallery_settings: nextSettings }).eq("id", resolved.clientId);
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=ok`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?social_oauth=network_error`, request.url));
  }
}
