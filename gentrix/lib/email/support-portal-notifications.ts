import { sendTransactionalEmail } from "@/lib/email/resend-send";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * E-mail naar factuuradres wanneer de studio een support-antwoord plaatst.
 * Faalt stil (dev-console bij Resend-fout); zonder RESEND_API_KEY: overgeslagen.
 */
export async function trySendSupportStaffReplyEmail(params: {
  clientId: string;
  threadId: string;
  threadSubject: string;
  staffDisplayName: string;
  messagePreview: string;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data: row, error } = await supabase
      .from("clients")
      .select("billing_email, name, subfolder_slug")
      .eq("id", params.clientId)
      .maybeSingle();

    if (error || !row) return;

    const r = row as { billing_email: string | null; name: string; subfolder_slug: string };
    const to = r.billing_email?.trim();
    if (!to) return;

    const base = getPublicAppUrl().replace(/\/$/, "");
    const encSlug = encodeURIComponent(r.subfolder_slug);
    const supportUrl = `${base}/portal/${encSlug}/support`;

    const subjectLine = params.threadSubject.trim().slice(0, 120) || "Support";
    const rawPreview = params.messagePreview.trim();
    const preview = rawPreview.replace(/\s+/g, " ").slice(0, 280);
    const previewTruncated = rawPreview.length > 280;
    const who = params.staffDisplayName.trim() || "Studio";

    const subject = `Nieuw bericht in support — ${r.name}`;
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #18181b;">
  <p>Hallo,</p>
  <p><strong>${escapeHtml(who)}</strong> heeft gereageerd op je onderwerp <strong>${escapeHtml(subjectLine)}</strong> in het klantportaal van <strong>${escapeHtml(r.name)}</strong>.</p>
  ${
    preview
      ? `<blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #3b82f6; background: #f4f4f5; font-size: 14px;">${escapeHtml(preview)}${previewTruncated ? "…" : ""}</blockquote>`
      : ""
  }
  <p style="margin: 20px 0;">
    <a href="${escapeHtml(supportUrl)}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
      Open support in portaal
    </a>
  </p>
  <p style="font-size: 13px; color: #71717a;">Dit bericht is automatisch verstuurd. Log in met het e-mailadres waarmee je bent uitgenodigd.</p>
</body>
</html>`.trim();

    const text = [
      `${who} heeft gereageerd op: ${subjectLine} (${r.name}).`,
      "",
      preview ? `${preview}${previewTruncated ? "…" : ""}` : "",
      "",
      `Bekijk het gesprek: ${supportUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await sendTransactionalEmail({ to, subject, html, text });
    if (!res.ok && process.env.NODE_ENV === "development") {
      console.warn("[support mail]", res.error);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[support mail]", e);
    }
  }
}
