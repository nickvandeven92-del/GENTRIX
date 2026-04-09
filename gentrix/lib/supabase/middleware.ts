import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

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

  if (pathname === "/login/mfa" && !user) {
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
    const needsMfa =
      aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (needsMfa && !pathname.startsWith("/login")) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(mfaUrl);
    }
  }

  if (isLoginPath(pathname) && user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa =
      aalData?.nextLevel === "aal2" && aalData?.currentLevel !== "aal2";

    if (pathname === "/login" && needsMfa) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set("next", request.nextUrl.searchParams.get("next") ?? "/home");
      return NextResponse.redirect(mfaUrl);
    }

    if (!needsMfa && pathname === "/login") {
      const next = request.nextUrl.searchParams.get("next") ?? "/home";
      if (!next.startsWith("/")) {
        return supabaseResponse;
      }
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (!needsMfa && pathname === "/login/mfa") {
      const next = request.nextUrl.searchParams.get("next") ?? "/home";
      if (next.startsWith("/")) {
        return NextResponse.redirect(new URL(next, request.url));
      }
    }
  }

  return supabaseResponse;
}
