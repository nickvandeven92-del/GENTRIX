import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";

type RouteContext = { params: Promise<{ slug: string }> };

const COOKIE_NAME = "gentrix_reviews_oauth_state";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function GET(request: Request, context: RouteContext) {
  const { slug: raw } = await context.params;
  const slug = decodeURIComponent(raw);
  const provider = new URL(request.url).searchParams.get("provider") === "trustpilot" ? "trustpilot" : "google";
  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
  }
  if (!checkPortalRateLimit(access.userId, `portal:reviews:oauth:start:${slug}`, 20)) {
    return NextResponse.json({ ok: false, error: "Te veel verzoeken." }, { status: 429 });
  }

  const origin = requestOrigin(request);
  const redirectUri = `${origin}/api/portal/reviews/oauth/callback`;
  const state = `${provider}:${encodeURIComponent(slug)}:${randomUUID()}`;
  (await cookies()).set(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/api/portal/reviews/oauth",
  });

  if (provider === "google") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.redirect(`${origin}/portal/${encodeURIComponent(slug)}/reviews?reviews_oauth=missing_google_env`);
    }
    const scope = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/business.manage",
    ].join(" ");
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&access_type=offline` +
      `&include_granted_scopes=true` +
      `&scope=${encodeURIComponent(scope)}` +
      `&state=${encodeURIComponent(state)}`;
    return NextResponse.redirect(authUrl);
  }

  const clientId = process.env.TRUSTPILOT_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.redirect(`${origin}/portal/${encodeURIComponent(slug)}/reviews?reviews_oauth=missing_trustpilot_env`);
  }
  const authUrl =
    `https://authenticate.trustpilot.com` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;
  return NextResponse.redirect(authUrl);
}
