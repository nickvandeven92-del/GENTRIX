/**
 * Geheim voor HMAC van `gentrix_mfa`-cookie en e-mail OTP-hashes.
 *
 * Prioriteit:
 *   1) `MFA_SIGNING_SECRET` (aanbevolen, dedicated).
 *   2) Fallback: `SUPABASE_SERVICE_ROLE_KEY` in **development** — handig voor lokaal opstarten.
 *      In productie (`NODE_ENV=production`) faalt de helper hard zodat we nooit per ongeluk
 *      met een gedeelde/geroteerde key cookies vervalsen.
 *
 * Genereer een secret: `openssl rand -base64 48`
 */

const PROD = process.env.NODE_ENV === "production";

export class MfaSigningSecretMissingError extends Error {
  constructor() {
    super(
      "MFA_SIGNING_SECRET ontbreekt. Zet een dedicated geheim (minstens 32 bytes) in .env.local / hosting-env vars. " +
        "Genereer met: openssl rand -base64 48",
    );
    this.name = "MfaSigningSecretMissingError";
  }
}

/** Haalt het MFA-signing-secret op; throwt als er niets bruikbaars is in productie. */
export function getMfaSigningSecret(): string {
  const dedicated = process.env.MFA_SIGNING_SECRET?.trim();
  if (dedicated && dedicated.length >= 16) return dedicated;

  if (!PROD) {
    const dev = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (dev && dev.length >= 16) return dev;
  }

  throw new MfaSigningSecretMissingError();
}
