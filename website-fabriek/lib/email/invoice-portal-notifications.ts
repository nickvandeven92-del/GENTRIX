import { sendTransactionalEmail } from "@/lib/email/resend-send";
import { getPublicAppUrl } from "@/lib/site/public-app-url";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isPostgrestUnknownColumnError } from "@/lib/supabase/postgrest-unknown-column";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * E-mail naar factuuradres wanneer een factuur op “verzonden” staat en portaal-facturen aan staan.
 * Faalt stil (alleen dev-console bij Resend-fout).
 */
export async function trySendInvoiceSentPortalEmail(params: {
  clientId: string;
  invoiceId: string;
  invoiceNumber: string | null;
}): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    let sel = await supabase
      .from("clients")
      .select("billing_email, name, subfolder_slug, portal_invoices_enabled")
      .eq("id", params.clientId)
      .maybeSingle();

    if (sel.error && isPostgrestUnknownColumnError(sel.error, "portal_invoices_enabled")) {
      sel = await supabase
        .from("clients")
        .select("billing_email, name, subfolder_slug")
        .eq("id", params.clientId)
        .maybeSingle();
    }

    if (sel.error || !sel.data) return;

    const row = sel.data as {
      billing_email: string | null;
      name: string;
      subfolder_slug: string;
      portal_invoices_enabled?: boolean;
    };

    if (row.portal_invoices_enabled === false) return;

    const to = row.billing_email?.trim();
    if (!to) return;

    const base = getPublicAppUrl();
    const encSlug = encodeURIComponent(row.subfolder_slug);
    const encInv = encodeURIComponent(params.invoiceId);
    const detailUrl = `${base}/portal/${encSlug}/facturen/${encInv}`;
    const listUrl = `${base}/portal/${encSlug}/facturen`;
    const num = params.invoiceNumber?.trim() || "—";

    const subject = `Factuur ${num} — ${row.name}`;
    const html = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #18181b;">
  <p>Hallo,</p>
  <p>Er staat een nieuwe factuur voor u klaar in het klantportaal van <strong>${escapeHtml(row.name)}</strong>.</p>
  <p><strong>Factuurnummer:</strong> ${escapeHtml(num)}</p>
  <p style="margin: 20px 0;">
    <a href="${escapeHtml(detailUrl)}" style="display: inline-block; background: #1e3a8a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
      Factuur bekijken
    </a>
  </p>
  <p style="font-size: 14px; color: #52525b;">Alle facturen: <a href="${escapeHtml(listUrl)}">${escapeHtml(listUrl)}</a></p>
  <p style="font-size: 13px; color: #71717a;">Log in met het e-mailadres waarmee u bent uitgenodigd.</p>
</body>
</html>`.trim();

    const text = [
      `Er staat een nieuwe factuur klaar (${num}) voor ${row.name}.`,
      "",
      `Bekijk de factuur: ${detailUrl}`,
      `Alle facturen: ${listUrl}`,
    ].join("\n");

    const r = await sendTransactionalEmail({ to, subject, html, text });
    if (!r.ok && process.env.NODE_ENV === "development") {
      console.warn("[invoice mail]", r.error);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[invoice mail]", e);
    }
  }
}
