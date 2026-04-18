/**
 * Site-studio: gebruiker gaf geen vaste merk-/bedrijfsnaam. De waarde gaat mee in de API-body;
 * `generate-site-with-claude` vertaalt dit naar prompt-instructies (model verzint een pakkende naam).
 */
export const STUDIO_UNDECIDED_BRAND_SENTINEL = "__STUDIO_BRAND_TBD__";

export function isStudioUndecidedBrandName(name: string): boolean {
  return name.trim() === STUDIO_UNDECIDED_BRAND_SENTINEL;
}

/** UI / previews: geen ruwe sentinel tonen. */
export function displayStudioBrandNameForUi(name: string): string {
  const t = name.trim();
  if (!t) return "";
  if (isStudioUndecidedBrandName(t)) return "— model kiest merknaam";
  return t;
}
