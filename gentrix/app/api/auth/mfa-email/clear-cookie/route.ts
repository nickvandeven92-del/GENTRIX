import { NextResponse } from "next/server";
import { EMAIL_MFA_COOKIE_NAME, clearEmailMfaCookieOptions } from "@/lib/auth/email-mfa-cookie";

/** Leegt httpOnly MFA-cookie (bijv. na wachtwoordlogin of uitloggen). */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EMAIL_MFA_COOKIE_NAME, "", clearEmailMfaCookieOptions());
  return res;
}
