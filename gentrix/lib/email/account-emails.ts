/**
 * Account-gerelateerde transactionele e-mails:
 * - Welkom (na aanmaken account via Supabase auth webhook)
 * - Wachtwoord reset (voor admin/studio-login)
 */

import { buildBaseEmailHtml, buildBaseEmailText } from "@/lib/email/base-template";
import { sendTransactionalEmail } from "@/lib/email/resend-send";

export type AccountEmailResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Welkom
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(params: {
  to: string;
  /** Volledige naam of null als niet bekend. */
  name: string | null;
  /** URL van de inlogpagina. */
  loginUrl: string;
}): Promise<AccountEmailResult> {
  const greeting = params.name?.trim() ? `Hallo ${params.name.trim()},` : "Hallo,";

  const bodyHtml = `
    <p>${greeting}</p>
    <p>Welkom bij <strong>GENTRIX</strong>. Jouw account is aangemaakt en staat klaar.</p>
    <p>Log in via de knop hieronder om aan de slag te gaan.</p>
  `.trim();

  const html = buildBaseEmailHtml({
    preheader: "Welkom bij GENTRIX — je account staat klaar.",
    title: "Welkom bij GENTRIX",
    bodyHtml,
    ctaUrl: params.loginUrl,
    ctaLabel: "Inloggen",
    ctaNote: `Werkt de knop niet? Ga naar: ${params.loginUrl}`,
  });

  const text = buildBaseEmailText({
    title: "Welkom bij GENTRIX",
    lines: [
      greeting,
      "",
      "Welkom bij GENTRIX. Jouw account is aangemaakt en staat klaar.",
      "Log in via onderstaande link.",
    ],
    ctaUrl: params.loginUrl,
    ctaLabel: "Inloggen",
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: "Welkom bij GENTRIX",
    html,
    text,
  });
}

// ---------------------------------------------------------------------------
// Wachtwoord reset
// ---------------------------------------------------------------------------

export async function sendPasswordResetEmail(params: {
  to: string;
  /** Supabase recovery-link (al gegenereerd door de aanroeper). */
  resetUrl: string;
}): Promise<AccountEmailResult> {
  const bodyHtml = `
    <p>Hallo,</p>
    <p>We hebben een verzoek ontvangen om het wachtwoord voor <strong>${params.to}</strong> opnieuw in te stellen.</p>
    <p>Gebruik de knop hieronder om een nieuw wachtwoord te kiezen. De link is <strong>60 minuten</strong> geldig.</p>
    <p style="font-size:13px; color:#71717a;">
      Heb jij dit niet aangevraagd? Dan hoef je niets te doen — je wachtwoord verandert niet.
    </p>
  `.trim();

  const html = buildBaseEmailHtml({
    preheader: "Stel je wachtwoord opnieuw in via de link in deze e-mail.",
    title: "Wachtwoord opnieuw instellen",
    bodyHtml,
    ctaUrl: params.resetUrl,
    ctaLabel: "Nieuw wachtwoord instellen",
    ctaNote: `Werkt de knop niet? Kopieer deze link in je browser: ${params.resetUrl}`,
  });

  const text = buildBaseEmailText({
    title: "Wachtwoord opnieuw instellen",
    lines: [
      "Hallo,",
      "",
      `We hebben een verzoek ontvangen om het wachtwoord voor ${params.to} opnieuw in te stellen.`,
      "De link hieronder is 60 minuten geldig.",
      "",
      "Heb jij dit niet aangevraagd? Dan hoef je niets te doen.",
    ],
    ctaUrl: params.resetUrl,
    ctaLabel: "Nieuw wachtwoord instellen",
  });

  return sendTransactionalEmail({
    to: params.to,
    subject: "Wachtwoord opnieuw instellen — GENTRIX",
    html,
    text,
  });
}
