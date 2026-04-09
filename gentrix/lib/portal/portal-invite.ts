import type { PipelineStage } from "@/lib/commercial/client-commercial";
import { sendPortalInviteTransactionalEmail } from "@/lib/email/portal-invite-email";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const PURCHASE_PIPELINE_STAGES: ReadonlySet<PipelineStage> = new Set([
  "paid",
  "delivered",
  "live",
  "support",
]);

export function purchaseSignal(row: { payment_status: string; pipeline_stage: string }): boolean {
  return (
    row.payment_status === "paid" || PURCHASE_PIPELINE_STAGES.has(row.pipeline_stage as PipelineStage)
  );
}

/**
 * Automatische uitnodiging na commerciële wijziging: betaald / verder in pipeline + factuurmail, nog geen portaal-login.
 */
export function shouldTriggerAutoPortalInvite(
  before: {
    billing_email: string | null;
    portal_user_id: string | null;
    payment_status: string;
    pipeline_stage: string;
  } | null,
  after: {
    billing_email: string | null;
    portal_user_id: string | null;
    payment_status: string;
    pipeline_stage: string;
  },
): boolean {
  const emailAfter = after.billing_email?.trim() ?? "";
  if (!emailAfter || after.portal_user_id) return false;
  if (!purchaseSignal(after)) return false;

  const beforePurch = before ? purchaseSignal(before) : false;
  const afterPurch = purchaseSignal(after);
  const becamePurchased = afterPurch && !beforePurch;

  const hadEmail = Boolean(before?.billing_email?.trim());
  const becameEmail = !hadEmail && Boolean(emailAfter);

  return becamePurchased || becameEmail;
}

export type PortalInviteResult =
  | { ok: true; status: "sent"; email: string; emailDispatched: boolean }
  | { ok: true; status: "skipped"; reason: "no_email" | "already_linked" }
  | { ok: false; error: string };

export async function sendPortalInviteForClientSlug(
  subfolder_slug: string,
  options?: { forceResend?: boolean },
): Promise<PortalInviteResult> {
  const supabase = createServiceRoleClient();
  const { data: client, error: fe } = await supabase
    .from("clients")
    .select("id, name, billing_email, portal_user_id, subfolder_slug")
    .eq("subfolder_slug", subfolder_slug)
    .maybeSingle();

  if (fe || !client) {
    return { ok: false, error: fe?.message ?? "Klant niet gevonden." };
  }

  const email = client.billing_email?.trim() ?? "";
  if (!email) {
    return { ok: true, status: "skipped", reason: "no_email" };
  }

  if (client.portal_user_id && !options?.forceResend) {
    return { ok: true, status: "skipped", reason: "already_linked" };
  }

  const base = getPublicAppUrl();
  const redirectTo = `${base}/auth/callback?next=${encodeURIComponent("/home")}`;

  let linkRes = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: { portal_client_slug: client.subfolder_slug, full_name: client.name },
    },
  });

  let usedRecovery = false;
  if (linkRes.error) {
    const msg = linkRes.error.message.toLowerCase();
    const maybeExists =
      msg.includes("already been registered") ||
      msg.includes("already registered") ||
      msg.includes("user already exists") ||
      msg.includes("email address is already registered");

    if (!maybeExists) {
      return { ok: false, error: linkRes.error.message };
    }

    linkRes = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    usedRecovery = true;

    if (linkRes.error) {
      return { ok: false, error: linkRes.error.message };
    }
  }

  const userId = linkRes.data?.user?.id;
  const actionLink = linkRes.data?.properties?.action_link;
  if (!userId || !actionLink) {
    return { ok: false, error: "Geen uitnodigingslink ontvangen van auth." };
  }

  if (client.portal_user_id && client.portal_user_id !== userId) {
    return {
      ok: false,
      error:
        "Het factuur-e-mailadres hoort bij een ander login-account dan de portaal-koppeling in dit dossier. Controleer het e-mailadres of het veld Portaal-login (UUID).",
    };
  }

  if (!client.portal_user_id) {
    const { error: upErr } = await supabase.from("clients").update({ portal_user_id: userId }).eq("id", client.id);
    if (upErr) {
      return { ok: false, error: upErr.message };
    }
  }

  const mail = await sendPortalInviteTransactionalEmail({
    to: email,
    clientName: client.name,
    loginUrl: `${base}/login`,
    setPasswordUrl: actionLink,
    isRecovery: usedRecovery,
  });

  if (!mail.ok) {
    return { ok: false, error: mail.error };
  }

  const emailDispatched = !mail.skipped;
  if (!emailDispatched && process.env.NODE_ENV === "development") {
    console.info("[portal-invite] RESEND_API_KEY ontbreekt — eenmalige link (alleen voor lokaal testen):", actionLink);
  }

  return { ok: true, status: "sent", email, emailDispatched };
}
