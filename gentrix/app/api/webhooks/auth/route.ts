/**
 * Supabase Auth Webhook — ontvangt events bij gebruikersacties.
 *
 * Configuratie in Supabase Dashboard:
 *   Authentication → Hooks → "Send Email Hook" (of custom HTTP hook)
 *   URL: https://<jouw-domein>/api/webhooks/auth
 *   Secret: AUTH_WEBHOOK_SECRET (willekeurige string, min. 32 tekens)
 *
 * Ondersteunde events:
 *   - user.created  → welkom-email via Resend
 *
 * Verificatie via HMAC-SHA256 signature header (x-supabase-signature).
 *
 * @see https://supabase.com/docs/guides/auth/auth-hooks
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { sendWelcomeEmail } from "@/lib/email/account-emails";
import { getPublicAppUrl } from "@/lib/site/public-app-url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: {
    full_name?: string;
    name?: string;
    [key: string]: unknown;
  };
}

interface SupabaseAuthWebhookPayload {
  type: string;
  event?: string;
  record?: SupabaseAuthUser;
  user?: SupabaseAuthUser;
}

// ---------------------------------------------------------------------------
// Signature verificatie
// ---------------------------------------------------------------------------

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.AUTH_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Geen secret geconfigureerd → verificatie overslaan in development, weigeren in productie.
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[auth webhook] AUTH_WEBHOOK_SECRET niet gezet — verificatie overgeslagen (dev only).");
    return true;
  }

  if (!signatureHeader) return false;

  // Supabase stuurt: "sha256=<hex-digest>"
  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(parts[1], "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-supabase-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Ongeldige signature" }, { status: 401 });
  }

  let payload: SupabaseAuthWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as SupabaseAuthWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? payload.event ?? "";
  const user = payload.record ?? payload.user;

  if (eventType === "INSERT" || eventType === "user.created") {
    if (user?.email) {
      const name =
        user.user_metadata?.full_name?.trim() ||
        user.user_metadata?.name?.trim() ||
        null;

      const loginUrl = `${getPublicAppUrl()}/login`;

      const result = await sendWelcomeEmail({ to: user.email, name, loginUrl });

      if (!result.ok && process.env.NODE_ENV === "development") {
        console.warn("[auth webhook] Welkom-email mislukt:", result.error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
