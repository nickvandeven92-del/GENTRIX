/** IBAN normalisatie + mod-97 check (EU/NL). */

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * Standaard IBAN-validatie (mod 97 = 1). NL-IBAN is 18 tekens na normalisatie.
 */
export function isValidIban(ibanRaw: string): boolean {
  const iban = normalizeIban(ibanRaw);
  if (iban.length < 15 || iban.length > 34) return false;
  if (!/^[A-Z0-9]+$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const expanded = rearranged.replace(/[A-Z]/g, (c) => (c.charCodeAt(0) - 55).toString());
  let remainder = 0;
  for (let i = 0; i < expanded.length; i++) {
    const digit = expanded.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    remainder = (remainder * 10 + digit) % 97;
  }
  return remainder === 1;
}

export function isNlIban(ibanRaw: string): boolean {
  const iban = normalizeIban(ibanRaw);
  return /^NL\d{2}[A-Z]{4}\d{10}$/.test(iban);
}
