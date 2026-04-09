import { sendTransactionalEmail } from "@/lib/email/resend-send";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendPortalInviteTransactionalEmail(params: {
  to: string;
  clientName: string;
  loginUrl: string;
  setPasswordUrl: string;
  /** recovery = bestaande gebruiker, nieuwe wachtwoordlink */
  isRecovery: boolean;
}): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const to = params.to.trim();
  const subject = params.isRecovery
    ? `Nieuwe inloglink — ${params.clientName}`
    : `Uw toegang tot het klantportaal — ${params.clientName}`;

  const intro = params.isRecovery
    ? "U heeft een nieuwe link aangevraagd om uw wachtwoord te wijzigen of opnieuw in te stellen voor het klantportaal."
    : "Uw website staat klaar. U kunt inloggen op het klantportaal om facturen, afspraken en meer te bekijken.";

  const cta = params.isRecovery ? "Wachtwoord instellen / wijzigen" : "Wachtwoord instellen en starten";

  const html = `
<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8" /></head>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #18181b;">
  <p>Hallo,</p>
  <p>${escapeHtml(intro)}</p>
  <p><strong>Inloggen (gebruikersnaam)</strong><br />
  U logt in met dit e-mailadres: <strong>${escapeHtml(to)}</strong></p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(params.setPasswordUrl)}" style="display: inline-block; background: #1e3a8a; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;">
      ${escapeHtml(cta)}
    </a>
  </p>
  <p style="font-size: 14px; color: #52525b;">Werkt de knop niet? Kopieer deze link in uw browser:<br />
  <span style="word-break: break-all;">${escapeHtml(params.setPasswordUrl)}</span></p>
  <p style="font-size: 14px; color: #52525b;">Daarna kunt u altijd inloggen op:<br />
  <a href="${escapeHtml(params.loginUrl)}">${escapeHtml(params.loginUrl)}</a></p>
  <p style="font-size: 13px; color: #71717a; margin-top: 32px;">Met vriendelijke groet</p>
</body>
</html>
`.trim();

  const text = [
    intro,
    "",
    `Inloggen met e-mailadres (gebruikersnaam): ${to}`,
    "",
    `${cta}: ${params.setPasswordUrl}`,
    "",
    `Inlogpagina: ${params.loginUrl}`,
  ].join("\n");

  return sendTransactionalEmail({ to, subject, html, text });
}
