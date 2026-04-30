import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkPortalRateLimit } from "@/lib/api/portal-rate-limit";
import { requirePortalApiAccessForSlug } from "@/lib/auth/require-portal-api-access";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { parseReviewSourceSettings } from "@/lib/reviews/review-source";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const COOKIE_NAME = "gentrix_reviews_oauth_state";

function requestOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

function parseState(state: string): { provider: "google" | "trustpilot"; slug: string } | null {
  const first = state.indexOf(":");
  const second = state.indexOf(":", first + 1);
  if (first <= 0 || second <= first + 1) return null;
  const providerRaw = state.slice(0, first);
  const slugRaw = state.slice(first + 1, second);
  const provider = providerRaw === "trustpilot" ? "trustpilot" : providerRaw === "google" ? "google" : null;
  if (!provider) return null;
  try {
    const slug = decodeURIComponent(slugRaw);
    if (!slug) return null;
    return { provider, slug };
  } catch {
    return null;
  }
}

function firstDomainLike(input: unknown): string | null {
  const seen = new Set<unknown>();
  const queue: unknown[] = [input];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur == null || seen.has(cur)) continue;
    seen.add(cur);
    if (typeof cur === "string") {
      const t = cur.trim();
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t)) return t.toLowerCase();
      continue;
    }
    if (Array.isArray(cur)) {
      queue.push(...cur);
      continue;
    }
    if (typeof cur === "object") {
      queue.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return null;
}

function firstNameLike(input: unknown): string | null {
  const preferred = ["title", "displayName", "name", "businessName"] as const;
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  for (const key of preferred) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) {
      const t = (v as { text?: unknown }).text;
      if (typeof t === "string" && t.trim()) return t.trim();
    }
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const oauthError = url.searchParams.get("error") ?? "";
  const parsedState = parseState(state);
  const slug = parsedState?.slug ?? "";
  const provider = parsedState?.provider ?? "google";
  const fallbackRedirect = slug ? `/portal/${encodeURIComponent(slug)}/reviews` : "/portal";

  if (oauthError) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=denied`, request.url));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(COOKIE_NAME)?.value ?? "";
  cookieStore.delete(COOKIE_NAME);
  if (!code || !state || !storedState || state !== storedState || !parsedState) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=state_error`, request.url));
  }

  const access = await requirePortalApiAccessForSlug(slug);
  if (!access.ok) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=forbidden`, request.url));
  }
  if (!checkPortalRateLimit(access.userId, `portal:reviews:oauth:callback:${slug}`, 30)) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=rate_limited`, request.url));
  }

  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=no_client`, request.url));
  }
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("clients")
    .select("review_source_settings")
    .eq("id", resolved.clientId)
    .maybeSingle();
  const settings = parseReviewSourceSettings(row?.review_source_settings);
  const origin = requestOrigin(request);
  const redirectUri = `${origin}/api/portal/reviews/oauth/callback`;

  try {
    if (provider === "google") {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=missing_google_env`, request.url));
      }
      const tokenRes = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          code,
        }).toString(),
        timeoutMs: 15_000,
      });
      if (!tokenRes.ok) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_token_error`, request.url));
      }
      const tokenJson = (await tokenRes.json()) as { access_token?: string };
      const accessToken = tokenJson.access_token?.trim();
      if (!accessToken) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_token_empty`, request.url));
      }
      const accRes = await fetchWithTimeout("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        timeoutMs: 15_000,
      });
      if (!accRes.ok) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_accounts_error`, request.url));
      }
      const accJson = (await accRes.json()) as { accounts?: Array<{ name?: string; accountName?: string }> };
      const accounts = accJson.accounts ?? [];
      let placeId = "";
      let businessName = "";
      for (const acc of accounts) {
        const accountPath = acc.name?.trim();
        if (!accountPath) continue;
        const locRes = await fetchWithTimeout(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${accountPath}/locations?pageSize=20&readMask=name,title,metadata`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
            timeoutMs: 15_000,
          },
        );
        if (!locRes.ok) continue;
        const locJson = (await locRes.json()) as {
          locations?: Array<{ title?: string; metadata?: { placeId?: string } }>;
        };
        const first = (locJson.locations ?? []).find((l) => l.metadata?.placeId?.trim());
        if (first?.metadata?.placeId) {
          placeId = first.metadata.placeId.trim();
          businessName = first.title?.trim() || acc.accountName?.trim() || "";
          break;
        }
      }
      if (!placeId) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_no_place`, request.url));
      }
      const next = {
        ...settings,
        enabled: true,
        platform: "google" as const,
        identifier: placeId,
        businessName: businessName || settings.businessName,
        lastSyncStatus: "Google gekoppeld. Automatische synchronisatie gestart.",
      };
      const { error: upErr } = await supabase
        .from("clients")
        .update({ review_source_settings: next })
        .eq("id", resolved.clientId);
      if (upErr) {
        return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_save_error`, request.url));
      }
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=google_ok`, request.url));
    }

    const clientId = process.env.TRUSTPILOT_CLIENT_ID?.trim();
    const clientSecret = process.env.TRUSTPILOT_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=missing_trustpilot_env`, request.url));
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetchWithTimeout(
      "https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }).toString(),
        timeoutMs: 15_000,
      },
    );
    if (!tokenRes.ok) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=trustpilot_token_error`, request.url));
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token?.trim();
    if (!accessToken) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=trustpilot_token_empty`, request.url));
    }

    let identifier = settings.identifier;
    let businessName = settings.businessName;
    // Try to auto-discover business unit info from private endpoint payload.
    const buRes = await fetchWithTimeout("https://api.trustpilot.com/v1/private/business-units", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      timeoutMs: 15_000,
    });
    if (buRes.ok) {
      const buJson = await buRes.json();
      const maybeDomain = firstDomainLike(buJson);
      const maybeName = firstNameLike(buJson);
      if (maybeDomain) identifier = maybeDomain;
      if (maybeName) businessName = maybeName;
    }
    if (!identifier) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=trustpilot_no_business_unit`, request.url));
    }
    const next = {
      ...settings,
      enabled: true,
      platform: "trustpilot" as const,
      identifier,
      businessName,
      lastSyncStatus: "Trustpilot gekoppeld. Automatische synchronisatie gestart.",
    };
    const { error: upErr } = await supabase
      .from("clients")
      .update({ review_source_settings: next })
      .eq("id", resolved.clientId);
    if (upErr) {
      return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=trustpilot_save_error`, request.url));
    }
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=trustpilot_ok`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`${fallbackRedirect}?reviews_oauth=network_error`, request.url));
  }
}
