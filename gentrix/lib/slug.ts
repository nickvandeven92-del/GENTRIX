/**
 * `[slug]` uit de URL; veilig `decodeURIComponent` (kapotte `%`-sequenties geven geen URIError).
 */
export function decodeRouteSlugParam(raw: string | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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

/** Site-studio homepage op `/site/home`: altijd actief + live snapshot (geen concept-/betalingsmuur). */
export const STUDIO_HOMEPAGE_SUBFOLDER_SLUG = "home";

/**
 * Leesbare titel voor UI (tab, editor-kop) i.p.v. kale slug.
 * `staal-kunstenaar` → "Staal Kunstenaar"; `staalkunstenaar` → "Staalkunstenaar".
 */
export function formatSlugForDisplay(slug: string): string {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  const s = decoded.trim().toLowerCase();
  if (!s) return "";
  return s
    .split(/-+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("nl-NL") + w.slice(1))
    .join(" ");
}
