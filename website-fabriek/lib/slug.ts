/** Normaliseert naar subfolder_slug volgens DB-constraint: lowercase, 2–64 chars, alleen a-z, 0-9, koppeltekens. */
export function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  // Geen minimumlengte hier: bij live typen moet 1 teken zichtbaar blijven (validatie: isValidSubfolderSlug).
  return s;
}

export function isValidSubfolderSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length >= 2 && s.length <= 64;
}

/**
 * Leesbare titel voor UI (tab, editor-kop) i.p.v. kale slug.
 * `staal-kunstenaar` → "Staal Kunstenaar"; `staalkunstenaar` → "Staalkunstenaar".
 */
export function formatSlugForDisplay(slug: string): string {
  const s = decodeURIComponent(slug).trim().toLowerCase();
  if (!s) return "";
  return s
    .split(/-+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("nl-NL") + w.slice(1))
    .join(" ");
}
