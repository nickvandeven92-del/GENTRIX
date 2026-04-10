import type { TailwindSection } from "@/lib/ai/tailwind-sections-schema";

const BARE_HASH_HREF_RE = /\bhref\s*=\s*["']#["']/i;

/**
 * Harde regels na generator-postprocess: geen formulier op landingspagina, wél op contact;
 * geen lege `href="#"` (placeholder).
 */
export function validateMarketingSiteHardRules(
  landingSections: TailwindSection[],
  contactSections: TailwindSection[],
): string[] {
  const errors: string[] = [];
  const landingHtml = landingSections.map((s) => s.html).join("\n");
  const contactHtml = contactSections.map((s) => s.html).join("\n");
  if (/<form\b/i.test(landingHtml)) {
    errors.push(
      "Landingspagina mag geen HTML-<form> bevatten: het contact-/leadformulier hoort uitsluitend op de contactpagina.",
    );
  }
  if (!/<form\b/i.test(contactHtml)) {
    errors.push("Contactpagina moet minstens één <form> bevatten.");
  }
  if (BARE_HASH_HREF_RE.test(landingHtml) || BARE_HASH_HREF_RE.test(contactHtml)) {
    errors.push('Verboden: lege anker-links (href="#"). Gebruik echte sectie-ankers of __STUDIO_CONTACT_PATH__.');
  }
  return errors;
}
