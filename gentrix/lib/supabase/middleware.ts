import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safePostAuthRedirectPath } from "@/lib/auth/safe-same-origin-next-path";
import { EMAIL_MFA_COOKIE_NAME, verifyEmailMfaCookie } from "@/lib/auth/email-mfa-cookie";

function isLoginPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/login/");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  /** Uitnodiging / wachtwoord: sessie wordt gezet in route handler. */
  if (pathname.startsWith("/auth/")) {
    return supabaseResponse;
  }

  if ((pathname === "/login/mfa" || pathname === "/login/mfa-email") && !user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
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
    const needsTotp =
      aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (needsTotp && !pathname.startsWith("/login")) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(mfaUrl);
    }

    // Email MFA check — alleen als TOTP niet al vereist is
    if (!needsTotp) {
      const { data: emailMfaRow } = await supabase
        .from("admin_email_mfa")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (emailMfaRow) {
        const mfaCookie = request.cookies.get(EMAIL_MFA_COOKIE_NAME)?.value ?? "";
        const valid = mfaCookie ? await verifyEmailMfaCookie(mfaCookie, user.id) : false;
        if (!valid && !pathname.startsWith("/login")) {
          const mfaEmailUrl = new URL("/login/mfa-email", request.url);
          mfaEmailUrl.searchParams.set("next", pathname);
          return NextResponse.redirect(mfaEmailUrl);
        }
      }
    }
  }

  if (isLoginPath(pathname) && user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsTotp =
      aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (pathname === "/login" && needsTotp) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", request.nextUrl.searchParams.get("next") ?? "/home");
      return NextResponse.redirect(mfaUrl);
    }

    if (!needsTotp && pathname === "/login") {
      // Controleer of email MFA vereist is
      const { data: emailMfaRow } = await supabase
        .from("admin_email_mfa")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (emailMfaRow) {
        const mfaCookie = request.cookies.get(EMAIL_MFA_COOKIE_NAME)?.value ?? "";
        const valid = mfaCookie ? await verifyEmailMfaCookie(mfaCookie, user.id) : false;
        if (!valid) {
          const mfaEmailUrl = new URL("/login/mfa-email", request.url);
          mfaEmailUrl.searchParams.set(
            "next",
            request.nextUrl.searchParams.get("next") ?? "/home",
          );
          return NextResponse.redirect(mfaEmailUrl);
        }
      }

      const rawNext = request.nextUrl.searchParams.get("next");
      if (rawNext !== null && rawNext.trim() === "") {
        return supabaseResponse;
      }
      if (rawNext != null && rawNext.trim() !== "" && !rawNext.trim().startsWith("/")) {
        return supabaseResponse;
      }
      const next = safePostAuthRedirectPath(rawNext, request.url);
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (!needsTotp && (pathname === "/login/mfa" || pathname === "/login/mfa-email")) {
      const rawNext = request.nextUrl.searchParams.get("next");
      if (rawNext !== null && rawNext.trim() === "") {
        return supabaseResponse;
      }
      if (rawNext != null && rawNext.trim() !== "" && !rawNext.trim().startsWith("/")) {
        return supabaseResponse;
      }
      const next = safePostAuthRedirectPath(rawNext, request.url);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return supabaseResponse;
}
