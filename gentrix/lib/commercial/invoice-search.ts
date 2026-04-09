/**
 * Zoekstrategie facturen: nummerachtige invoer exact (sneller, geen brede ILIKE),
 * overige invoer fuzzy op klantnaam / nummer-deel.
 */

export function normalizeAdminSearchTerm(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/** INV-YYYY-NNN (case-insensitive). */
export function parseExactInvoiceNumberQuery(term: string): string | null {
  const t = term.trim();
  if (!/^INV-\d{4}-\d{3}$/i.test(t)) return null;
  return t.toUpperCase();
}

/** CL-YYYY-NNN (case-insensitive). */
export function parseExactClientNumberQuery(term: string): string | null {
  const t = term.trim();
  if (!/^CL-\d{4}-\d{3}$/i.test(t)) return null;
  return t.toUpperCase();
}
