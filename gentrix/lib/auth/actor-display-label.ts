/**
 * Zichtbare naam voor audit / eigenaar: voorkeur e-mail, anders afgekorte user-id.
 * Alleen server-side gebruiken (na requireAdminApiAuth).
 */
export function actorDisplayLabel(userId: string, email: string | null): string {
  const e = email?.trim();
  if (e) return e;
  return `Gebruiker ${userId.slice(0, 8)}…`;
}
