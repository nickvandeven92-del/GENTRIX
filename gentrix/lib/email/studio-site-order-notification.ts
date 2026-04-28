import { sendTransactionalEmail } from "@/lib/email/resend-send";
import { PUBLIC_STUDIO_CONTACT_EMAIL } from "@/lib/constants";

export type StudioSiteOrderPayload = {
  clientSubfolderSlug: string;
  isConceptPreview: boolean;
  firstName: string;
  lastName: string;
  companyName?: string;
  email: string;
  phone: string;
  postalCode: string;
  houseNumber: string;
  houseSuffix?: string;
  street: string;
  city: string;
  iban: string;
  accountHolder: string;
  includeSocialGallery?: boolean;
  notes?: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function row(k: string, v: string): string {
  return `<tr><td style="padding:6px 12px;border:1px solid #e4e4e7;font-weight:600;background:#fafafa;width:200px">${escapeHtml(
    k,
  )}</td><td style="padding:6px 12px;border:1px solid #e4e4e7">${escapeHtml(v)}</td></tr>`;
}

export async function notifyStudioOfSiteOrder(payload: StudioSiteOrderPayload): Promise<void> {
  const to = PUBLIC_STUDIO_CONTACT_EMAIL.trim();
  if (!to) return;

  const subject = `Website-bestelling — ${payload.clientSubfolderSlug}${payload.isConceptPreview ? " (concept)" : ""}`;
  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;font-size:14px;color:#18181b">
  <h1 style="font-size:18px">Nieuwe website-bestelling</h1>
  <table style="border-collapse:collapse;max-width:640px">${row("Klant-site (slug)", payload.clientSubfolderSlug)}${row(
    "Modus",
    payload.isConceptPreview ? "Concept-preview" : "Live / regulier",
  )}${row("Voornaam", payload.firstName)}${row("Achternaam", payload.lastName)}${
    payload.companyName ? row("Bedrijfsnaam", payload.companyName) : ""
  }${row("E-mail", payload.email)}${row("Telefoon", payload.phone)}${row("Postcode", payload.postalCode)}${row(
    "Huisnummer + toevoeging",
    `${payload.houseNumber}${payload.houseSuffix ? ` ${payload.houseSuffix}` : ""}`,
  )}${row("Straat", payload.street)}${row("Plaats", payload.city)}${row("IBAN", payload.iban)}${row(
    "Ten name van",
    payload.accountHolder,
  )}${row("Social gallery", payload.includeSocialGallery === false ? "Nee" : "Ja")}${payload.notes ? row("Opmerkingen", payload.notes) : ""}</table>
  <p style="margin-top:16px;font-size:12px;color:#71717a">Automatisch bericht vanaf het bestelformulier op de publieke site.</p>
  </body></html>`;

  const text = [
    subject,
    "",
    `Slug: ${payload.clientSubfolderSlug}`,
    `Concept: ${payload.isConceptPreview ? "ja" : "nee"}`,
    `Naam: ${payload.firstName} ${payload.lastName}`,
    payload.companyName ? `Bedrijf: ${payload.companyName}` : "",
    `E-mail: ${payload.email}`,
    `Tel: ${payload.phone}`,
    `Adres: ${payload.street}, ${payload.postalCode} ${payload.city}`,
    `Huisnr: ${payload.houseNumber}${payload.houseSuffix ? ` ${payload.houseSuffix}` : ""}`,
    `IBAN: ${payload.iban}`,
    `Rekeninghouder: ${payload.accountHolder}`,
    `Social gallery: ${payload.includeSocialGallery === false ? "nee" : "ja"}`,
    payload.notes ? `Opmerkingen: ${payload.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendTransactionalEmail({ to, subject, html, text });
}
