import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const SCRYPT_LEN = 32;
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1 } as const;

function normalizePin(pin: string): string {
  return pin.trim();
}

export function isValidAgendaPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(normalizePin(pin));
}

/** Opslagstring: `v1$<saltHex>$<hashHex>` */
export function hashAgendaPin(pin: string): string {
  const p = normalizePin(pin);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(p, salt, SCRYPT_LEN, SCRYPT_OPTS).toString("hex");
  return `${VERSION}$${salt}$${hash}`;
}

export function verifyAgendaPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== VERSION) return false;
  const [, salt, expectedHex] = parts;
  if (!/^[0-9a-f]{32}$/i.test(salt) || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
  try {
    const got = scryptSync(normalizePin(pin), salt, SCRYPT_LEN, SCRYPT_OPTS);
    const exp = Buffer.from(expectedHex, "hex");
    if (got.length !== exp.length) return false;
    return timingSafeEqual(got, exp);
  } catch {
    return false;
  }
}
