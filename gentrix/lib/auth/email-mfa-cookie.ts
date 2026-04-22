/**
 * Signed httpOnly cookie voor email-OTP MFA sessies.
 *
 * Formaat:  <userId>.<issuedAtMs>.<base64url-HMAC-SHA256>
 * Geldig:   24 uur
 * Sleutel:  MFA_SIGNING_SECRET (fallback in dev: SUPABASE_SERVICE_ROLE_KEY — zie mfa-signing-secret.ts)
 *
 * Productie-hardening:
 *   - geen statische fallback-string (dev-fallback alleen op NODE_ENV !== production)
 *   - verificatie via `crypto.subtle.verify` (constant-time intern)
 */

import { getMfaSigningSecret } from "@/lib/auth/mfa-signing-secret";

export const EMAIL_MFA_COOKIE_NAME = "gentrix_mfa";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64urlDecode(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  const decoded = atob(padded + "=".repeat(pad));
  const arr = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) arr[i] = decoded.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function getKey(): Promise<CryptoKey> {
  const secret = getMfaSigningSecret();
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

    if (!userId || userId !== expectedUserId) return false;
    if (!Number.isFinite(iat)) return false;
    const age = Date.now() - iat;
    if (age > MAX_AGE_MS || age < 0) return false;

    const key = await getKey();
    const sigBytes = b64urlDecode(sigB64);
    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

/** Cookie-opties voor Next.js response headers. */
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

/** Wis `gentrix_mfa` (zelfde pad/flags als bij zetten, maxAge 0). */
export function clearEmailMfaCookieOptions(): {
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
    maxAge: 0,
  };
}
