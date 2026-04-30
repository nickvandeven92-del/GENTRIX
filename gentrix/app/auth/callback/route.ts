import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safePostAuthRedirectPath } from "@/lib/auth/safe-same-origin-next-path";
import { EMAIL_MFA_COOKIE_NAME, clearEmailMfaCookieOptions } from "@/lib/auth/email-mfa-cookie";

/**
 * Supabase Auth redirect: PKCE (`code`) en e-mailverificatie (`token_hash` + `type`).
 * Zet `https://…/auth/callback` in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safePostAuthRedirectPath(searchParams.get("next"), request.url);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/login?error=config`);
  }

  let response = NextResponse.redirect(`${origin}${next}`);

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      response.cookies.set(EMAIL_MFA_COOKIE_NAME, "", clearEmailMfaCookieOptions());
      return response;
    }
    return NextResponse.redirect(`${origin}/login?error=auth_callback`);
  }

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      response.cookies.set(EMAIL_MFA_COOKIE_NAME, "", clearEmailMfaCookieOptions());
      return response;
    }
    return NextResponse.redirect(`${origin}/login?error=auth_confirm`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
