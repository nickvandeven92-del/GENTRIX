/**
 * Signed httpOnly cookie voor email-OTP MFA sessies.
 *
 * Formaat:  <userId>.<issuedAtMs>.<base64url-HMAC-SHA256>
 * Geldig:   24 uur
 * Sleutel:  SUPABASE_SERVICE_ROLE_KEY (al beschikbaar server-side)
 */

export const EMAIL_MFA_COOKIE_NAME = "gentrix_mfa";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 uur

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  const decoded = atob(padded + "=".repeat(pad));
  return Uint8Array.from(decoded, (c) => c.charCodeAt(0));
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "gentrix-fallback-mfa-key";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signEmailMfaCookie(userId: string): Promise<string> {
  const iat = Date.now().toString();
  const payload = `${userId}.${iat}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyEmailMfaCookie(
  cookie: string,
  expectedUserId: string,
): Promise<boolean> {
  try {
    const lastDot = cookie.lastIndexOf(".");
    if (lastDot < 0) return false;
    const payload = cookie.slice(0, lastDot);
    const sigB64 = cookie.slice(lastDot + 1);

    const dotIdx = payload.indexOf(".");
    if (dotIdx < 0) return false;
    const userId = payload.slice(0, dotIdx);
    const iat = parseInt(payload.slice(dotIdx + 1), 10);

    if (userId !== expectedUserId) return false;
    const age = Date.now() - iat;
    if (age > MAX_AGE_MS || age < 0) return false;

    const key = await getKey();
    const sigBytes = b64urlDecode(sigB64);
    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

/** Cookie-opties voor Next.js response headers */
export function emailMfaCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  };
}
