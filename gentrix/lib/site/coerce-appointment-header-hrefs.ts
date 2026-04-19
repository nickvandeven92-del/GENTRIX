import { STUDIO_BOOKING_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/**
 * Als de AI (of handmatige edit) per ongeluk WhatsApp op de primaire afspraak-knop in de header zet,
 * maar de tekst duidelijk om een afspraak gaat, dwingen we het studio-boekingspad (compose lost het op naar `/boek/{slug}`).
 */
export function coerceHeaderWhatsappLinksToBookingPlaceholder(html: string): string {
  return html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, (headerBlock) =>
    headerBlock.replace(
      /<a\b([^>]*?)\bhref\s*=\s*(["'])(https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)[^"']*)\2([^>]*)>([\s\S]*?)<\/a>/gi,
      (full, pre, quote, _badUrl, post, inner) => {
        const textOnly = inner.replace(/<[^>]+>/g, "").trim();
        if (!textOnly) return full;
        if (!/(afspraak|boek(?:\s+online)?|plan(?:\s+een)?\s+afspraak)/i.test(textOnly)) return full;
        return `<a${pre}href=${quote}${STUDIO_BOOKING_PATH_PLACEHOLDER}${quote}${post}>${inner}</a>`;
      },
    ),
  );
}
