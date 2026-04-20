/**
 * Gedeelde branded HTML-builder voor alle transactionele e-mails.
 *
 * Gebruik: geef bodyHtml mee (de inhoud tussen header en footer).
 * Optioneel: ctaUrl + ctaLabel voor één primaire actieknop.
 */

export type BaseEmailOptions = {
  /** Wordt getoond boven de `<title>` én als pre-header snippet. */
  preheader: string;
  /** Groot kopregel bovenaan de e-mail. */
  title: string;
  /** Overige HTML-content (paragrafen, lijsten). Geen volledige omhulling nodig. */
  bodyHtml: string;
  /** Primaire CTA. Beide verplicht als je een knop wilt. */
  ctaUrl?: string;
  ctaLabel?: string;
  /** Optionele secundaire tekst onder de knop. */
  ctaNote?: string;
};

const BRAND = "GENTRIX";
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_STUDIO_CONTACT_EMAIL?.trim() || "support@gentrix.nl";
const BRAND_COLOR = "#1e3a8a"; // blue-900
const FOOTER_ADDRESS = process.env.EMAIL_FOOTER_ADDRESS?.trim() || "Gentrix · KVK 12345678 · Nederland";
const UNSUBSCRIBE_URL = process.env.EMAIL_UNSUBSCRIBE_BASE_URL?.trim() || "";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildBaseEmailHtml(opts: BaseEmailOptions): string {
  const ctaBlock =
    opts.ctaUrl && opts.ctaLabel
      ? `
    <tr>
      <td align="center" style="padding: 24px 0 8px;">
        <a href="${escapeHtml(opts.ctaUrl)}"
           style="display:inline-block; background:${BRAND_COLOR}; color:#ffffff;
                  text-decoration:none; padding:14px 28px; border-radius:8px;
                  font-size:15px; font-weight:600; letter-spacing:0.01em;">
          ${escapeHtml(opts.ctaLabel)}
        </a>
      </td>
    </tr>
    ${
      opts.ctaNote
        ? `<tr>
      <td style="padding: 4px 0 16px; text-align:center; font-size:13px; color:#71717a;">
        ${escapeHtml(opts.ctaNote)}
      </td>
    </tr>`
        : ""
    }`
      : "";

  const unsubscribeBlock = UNSUBSCRIBE_URL
    ? `<a href="${escapeHtml(UNSUBSCRIBE_URL)}" style="color:#a1a1aa; text-decoration:underline;">Uitschrijven</a> &nbsp;·&nbsp; `
    : "";

  return `<!DOCTYPE html>
<html lang="nl" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]><style>body{font-family:Arial,sans-serif!important}</style><![endif]-->
  <style>
    body { margin:0; padding:0; background:#f4f4f5; }
    @media only screen and (max-width:600px) {
      .email-wrapper { padding: 12px !important; }
      .email-card   { border-radius: 8px !important; }
    }
  </style>
</head>
<body>
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f5;line-height:1px;">
    ${escapeHtml(opts.preheader)}
    &nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr>
      <td class="email-wrapper" style="padding:32px 16px;">
        <table class="email-card" align="center" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td style="background:${BRAND_COLOR}; padding:20px 32px;">
              <span style="color:#ffffff; font-family:Arial,sans-serif; font-size:18px; font-weight:700;
                           letter-spacing:0.08em; text-transform:uppercase;">
                ${escapeHtml(BRAND)}
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px; font-family:Arial,sans-serif; font-size:15px;
                       line-height:1.6; color:#18181b;">
              <h1 style="margin:0 0 20px; font-size:22px; font-weight:700; color:#0f172a;
                          letter-spacing:-0.01em; line-height:1.3;">
                ${escapeHtml(opts.title)}
              </h1>

              ${opts.bodyHtml}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${ctaBlock}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:24px 32px 0;">
              <hr style="border:none; border-top:1px solid #e4e4e7; margin:0;" />
            </td>
          </tr>

          <!-- Support -->
          <tr>
            <td style="padding:20px 32px; font-family:Arial,sans-serif; font-size:13px;
                       color:#52525b; line-height:1.5;">
              Vragen? Stuur een bericht naar
              <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:${BRAND_COLOR}; text-decoration:none;">
                ${escapeHtml(SUPPORT_EMAIL)}
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:16px 32px; font-family:Arial,sans-serif;
                       font-size:11px; color:#a1a1aa; line-height:1.5; border-top:1px solid #e4e4e7;">
              ${unsubscribeBlock}
              ${escapeHtml(FOOTER_ADDRESS)}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Plain-text fallback builder — stripped version voor e-mailclients die HTML weigeren.
 */
export function buildBaseEmailText(opts: {
  title: string;
  lines: string[];
  ctaUrl?: string;
  ctaLabel?: string;
  supportEmail?: string;
}): string {
  const support = opts.supportEmail ?? SUPPORT_EMAIL;
  return [
    `${BRAND} — ${opts.title}`,
    "",
    ...opts.lines,
    ...(opts.ctaUrl && opts.ctaLabel
      ? ["", `${opts.ctaLabel}:`, opts.ctaUrl]
      : []),
    "",
    "---",
    `Vragen? Mail naar ${support}`,
    FOOTER_ADDRESS,
  ].join("\n");
}
