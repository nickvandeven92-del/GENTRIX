import {
  STUDIO_BOOKING_PATH_PLACEHOLDER,
  STUDIO_CONTACT_PATH_PLACEHOLDER,
  STUDIO_SITE_BASE_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";
import { walkBalancedSameLocalBlock } from "@/lib/site/html-balanced-element";

/** Zichtbare tekst op een knop/link duidt op online boeken, niet op het contactformulier. */
const BOOKING_INTENT_IN_ANCHOR_TEXT_RE =
  /(afspraak|reserveer|reserveren|boek(?:\s+online)?|plan(?:\s+een)?\s+afspraak|maak\s+een\s+afspraak)/i;

const CONTACT_HREF_ESCAPED = STUDIO_CONTACT_PATH_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SITE_BASE_HREF_ESCAPED = STUDIO_SITE_BASE_PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `<a href="#contact">`, contact-placeholder, `__STUDIO_SITE_BASE__/contact` (multipage),
 * of al-opgeloste paden als `/site/{slug}/contact` → booking-placeholder wanneer de zichtbare
 * tekst duidelijk om boeken gaat.
 *
 * Het `\/[^"'#?]+\/contact` patroon matcht opgeloste paden die eindigen op `/contact`
 * (bv. `/site/mosham/contact`), veilig omdat de booking-intent-check dit verder beperkt.
 */
const CONTACT_OR_HASH_CONTACT_ANCHOR_RE = new RegExp(
  `<a\\b([^>]*?)\\bhref\\s*=\\s*(["'])(#contact\\b|${CONTACT_HREF_ESCAPED}|${SITE_BASE_HREF_ESCAPED}\\/contact|\\/[^"'#?]+\\/contact(?:[?#][^"']*)?)\\2([^>]*)>([\\s\\S]*?)<\\/a>`,
  "gi",
);

function mapBalancedHeaders(html: string, fn: (headerBlock: string) => string): string {
  let cursor = 0;
  let out = "";
  let pos = 0;
  while (pos < html.length) {
    const m = /<header\b/gi.exec(html.slice(pos));
    if (!m) break;
    const abs = pos + m.index;
    const w = walkBalancedSameLocalBlock(html, abs, "header");
    if (!w) {
      pos = abs + 1;
      continue;
    }
    out += html.slice(cursor, w.start);
    out += fn(w.block);
    cursor = w.end;
    pos = w.end;
  }
  out += html.slice(cursor);
  return out;
}

function rewriteContactHrefToBookingWhenIntentBooking(fragment: string): string {
  return fragment.replace(
    CONTACT_OR_HASH_CONTACT_ANCHOR_RE,
    (full, pre: string, quote: string, _hrefVal: string, post: string, inner: string) => {
      const textOnly = inner.replace(/<[^>]+>/g, "").trim();
      if (!textOnly) return full;
      if (!BOOKING_INTENT_IN_ANCHOR_TEXT_RE.test(textOnly)) return full;
      return `<a${pre}href=${quote}${STUDIO_BOOKING_PATH_PLACEHOLDER}${quote}${post}>${inner}</a>`;
    },
  );
}

/** Publieke compose: hele fragment (bv. alle HTML van tailwind-sectie `id: "hero"`). */
export function coerceContactBookCtaAnchorsInHtmlFragment(html: string): string {
  return rewriteContactHrefToBookingWhenIntentBooking(html);
}

/**
 * Als de AI (of handmatige edit) per ongeluk WhatsApp op de primaire afspraak-knop in de header zet,
 * maar de tekst duidelijk om een afspraak gaat, dwingen we het studio-boekingspad (compose lost het op naar `/booking-app/book/{slug}`).
 */
export function coerceHeaderWhatsappLinksToBookingPlaceholder(html: string): string {
  return mapBalancedHeaders(html, (headerBlock) =>
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

/**
 * Binnen `<header>`: CTA’s met boek-/reserveer-tekst maar `href` naar contact-routes
 * → `__STUDIO_BOOKING_PATH__` (geen DB-wijziging; alleen compose voor live `/site`).
 */
export function coerceHeaderContactBookCtasToBookingPlaceholder(html: string): string {
  return mapBalancedHeaders(html, rewriteContactHrefToBookingWhenIntentBooking);
}

/**
 * Binnen `<section id="hero">` (waarde `hero` hoofdletterongevoelig).
 */
export function coerceHeroContactBookCtasToBookingPlaceholder(html: string): string {
  return html.replace(
    /<section\b[^>]*\bid\s*=\s*(["'])([Hh][Ee][Rr][Oo])\1[^>]*>[\s\S]*?<\/section>/g,
    rewriteContactHrefToBookingWhenIntentBooking,
  );
}

/**
 * Volledige compose-fix voor afspraken-module: WhatsApp → booking, daarna contact-routes → booking
 * in header én inner `<section id="hero">` (upgrade niet nodig).
 */
export function coerceHeaderAppointmentCtaHrefs(html: string): string {
  let h = coerceHeaderWhatsappLinksToBookingPlaceholder(html);
  h = coerceHeaderContactBookCtasToBookingPlaceholder(h);
  h = coerceHeroContactBookCtasToBookingPlaceholder(h);
  return h;
}
