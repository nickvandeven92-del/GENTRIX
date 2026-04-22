import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safePostAuthRedirectPath } from "@/lib/auth/safe-same-origin-next-path";
import { EMAIL_MFA_COOKIE_NAME, verifyEmailMfaCookie } from "@/lib/auth/email-mfa-cookie";

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

/**
 * Bepaal een veilige "next"-redirect voor ingelogde users op login-paden.
 * Geeft `null` terug als middleware de pagina moet laten renderen (geen redirect).
 */
function resolvePostAuthRedirect(request: NextRequest): URL | null {
  const rawNext = request.nextUrl.searchParams.get("next");
  if (rawNext !== null && rawNext.trim() === "") return null;
  if (rawNext != null && rawNext.trim() !== "" && !rawNext.trim().startsWith("/")) {
    return null;
  }
  const next = safePostAuthRedirectPath(rawNext, request.url);
  return new URL(next, request.url);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return supabaseResponse;

  const pathname = request.nextUrl.pathname;

  // API-routes hebben hun eigen auth-helper (require*ApiAuth); geen session-kosten in middleware.
  // We skippen ook /_next/* en public assets — normaal zijn die al door de matcher uitgesloten,
  // maar deze guard scheelt Supabase-calls voor api-paden die wél door de matcher komen.
  if (pathname.startsWith("/api/")) return supabaseResponse;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** Uitnodiging / wachtwoord: sessie wordt gezet in route handler. */
  if (pathname.startsWith("/auth/")) return supabaseResponse;

  if ((pathname === "/login/mfa" || pathname === "/login/mfa-email") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const needsAuthAndMfa =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/portal") ||
    pathname === "/home" ||
    pathname === "/dashboard";

  if (needsAuthAndMfa) {
    if (!user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsTotp = aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (needsTotp && !pathname.startsWith("/login")) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(mfaUrl);
    }

    if (!needsTotp) {
      const mfaCookie = request.cookies.get(EMAIL_MFA_COOKIE_NAME)?.value ?? "";
      const valid = mfaCookie ? await verifyEmailMfaCookie(mfaCookie, user.id) : false;
      if (!valid && !pathname.startsWith("/login")) {
        const mfaEmailUrl = new URL("/login/mfa-email", request.url);
        mfaEmailUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(mfaEmailUrl);
      }
    }
  }

  if (isLoginPath(pathname) && user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsTotp = aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (pathname === "/login" && needsTotp) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", request.nextUrl.searchParams.get("next") ?? "/home");
      return NextResponse.redirect(mfaUrl);
    }

    const mfaCookie = request.cookies.get(EMAIL_MFA_COOKIE_NAME)?.value ?? "";
    const emailMfaValid = mfaCookie ? await verifyEmailMfaCookie(mfaCookie, user.id) : false;

    if (!needsTotp && pathname === "/login") {
      if (!emailMfaValid) {
        const mfaEmailUrl = new URL("/login/mfa-email", request.url);
        mfaEmailUrl.searchParams.set("next", request.nextUrl.searchParams.get("next") ?? "/home");
        return NextResponse.redirect(mfaEmailUrl);
      }
      const to = resolvePostAuthRedirect(request);
      return to ? NextResponse.redirect(to) : supabaseResponse;
    }

    if (!needsTotp && pathname === "/login/mfa") {
      const to = resolvePostAuthRedirect(request);
      return to ? NextResponse.redirect(to) : supabaseResponse;
    }

    if (!needsTotp && pathname === "/login/mfa-email") {
      if (!emailMfaValid) return supabaseResponse;
      const to = resolvePostAuthRedirect(request);
      return to ? NextResponse.redirect(to) : supabaseResponse;
    }
  }

  return supabaseResponse;
}
