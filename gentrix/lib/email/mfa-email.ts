import { buildBaseEmailHtml, buildBaseEmailText } from "@/lib/email/base-template";
import { sendTransactionalEmail } from "@/lib/email/resend-send";

export async function sendMfaCodeEmail(params: {
  to: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const bodyHtml = `
    <p>Hallo,</p>
    <p>Gebruik onderstaande code om in te loggen bij <strong>GENTRIX</strong>.</p>
    <p style="font-size:32px; font-weight:700; letter-spacing:0.18em; text-align:center; color:#1e3a8a; margin:24px 0;">
      ${params.code}
    </p>
    <p style="font-size:13px; color:#71717a;">
      De code is <strong>10 minuten</strong> geldig. Heb jij dit niet aangevraagd? Dan is er mogelijk
      iemand die probeert in te loggen op jouw account. Wijzig dan direct je wachtwoord.
    </p>
  `.trim();

  const html = buildBaseEmailHtml({
    preheader: `Je GENTRIX inlogcode: ${params.code}`,
    title: "Inlogcode",
    bodyHtml,
  });

  const text = buildBaseEmailText({
    title: "Inlogcode GENTRIX",
    lines: [
      "Hallo,",
      "",
      `Je inlogcode is: ${params.code}`,
      "",
      "De code is 10 minuten geldig.",
      "Heb jij dit niet aangevraagd? Wijzig dan direct je wachtwoord.",
    ],
  });

  const result = await sendTransactionalEmail({
    to: params.to,
    subject: `${params.code} — GENTRIX inlogcode`,
    html,
    text,
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
