/**
 * PostgREST error when SELECT references a column that is not in the DB yet
 * (migratie nog niet uitgevoerd of schema-cache).
 */
export function isPostgrestUnknownColumnError(
  error: { message?: string } | null | undefined,
  columnName: string,
): boolean {
  const m = (error?.message ?? "").toLowerCase();
  const col = columnName.toLowerCase();
  if (!m.includes(col)) return false;
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}
