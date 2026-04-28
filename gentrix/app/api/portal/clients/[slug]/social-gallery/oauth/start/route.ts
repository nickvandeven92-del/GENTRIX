import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";

type RouteContext = { params: Promise<{ slug: string }> };

const COOKIE_NAME = "gentrix_social_oauth_state";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const provider = new URL(request.url).searchParams.get("provider") === "facebook" ? "facebook" : "instagram";
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:social-gallery:oauth:start:${slug}`, 30)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const appId = process.env.META_APP_ID?.trim();
  if (!appId) {
    return NextResponse.json({ ok: false, error: "META_APP_ID ontbreekt in env." }, { status: 503 });
  }

  const origin = requestOrigin(request);
  const redirectUri = `${origin}/api/portal/clients/${encodeURIComponent(slug)}/social-gallery/oauth/callback`;
  const state = `${provider}.${randomUUID()}`;
  (await cookies()).set(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: `/api/portal/clients/${encodeURIComponent(slug)}/social-gallery/oauth`,
  });

  const scope =
    provider === "instagram"
      ? "pages_show_list,instagram_basic,instagram_manage_insights,business_management"
      : "pages_show_list,pages_read_engagement";
  const authUrl =
    `https://www.facebook.com/v20.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(authUrl);
}
