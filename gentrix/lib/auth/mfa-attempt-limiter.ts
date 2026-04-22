/**
 * In-memory brute-force guard voor e-mail OTP-codes.
 *
 * Werkt als backup voor de DB-attempt-teller (zie migratie
 * `20260430120000_admin_email_mfa_codes_attempts.sql`). Zolang een codeId veelal binnen
 * enkele seconden op dezelfde lambda-instance wordt geverifieerd geeft deze teller
 * voldoende bescherming tegen triviaal brute-forcen van de 6-cijferige code.
 */

import { checkMemoryRateLimit, resetMemoryRateLimit } from "@/lib/api/rate-limit-memory";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function attemptKey(codeId: string): string {
  return `mfa:attempts:${codeId}`;
}

/**
 * Registreert een poging. Retourneert `true` zolang er nog pogingen open staan,
 * `false` als de limiet is bereikt (code moet dan als verbruikt worden gemarkeerd).
 */
export function registerMfaAttempt(codeId: string): boolean {
  return checkMemoryRateLimit(attemptKey(codeId), MAX_ATTEMPTS, WINDOW_MS);
}

/** Na geslaagde verificatie: opruimen. */
export function clearMfaAttempts(codeId: string): void {
  resetMemoryRateLimit(attemptKey(codeId));
}
