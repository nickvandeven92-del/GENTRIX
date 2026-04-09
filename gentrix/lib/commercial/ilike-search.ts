/** Escapes % en _ voor PostgREST ilike-patterns. */
export function escapeForIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function searchTerms(raw: string | undefined): string | null {
  const t = raw?.trim();
  return t && t.length > 0 ? t : null;
}
