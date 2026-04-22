/**
 * Cryptografisch veilige numerieke OTP-generatie zonder modulo-bias.
 *
 * Simpel `byte % 10` geeft een lichte voorkeur voor 0..5 (256 / 10 = 25.6).
 * We verwerpen bytes ≥ 250 en trekken een nieuwe — uniform over 0..9.
 */

export function generateNumericOtp(length: number): string {
  if (length <= 0 || length > 32) {
    throw new RangeError("OTP length must be between 1 and 32");
  }
  let result = "";
  const chunk = new Uint8Array(Math.max(length * 2, 16));
  while (result.length < length) {
    crypto.getRandomValues(chunk);
    for (let i = 0; i < chunk.length && result.length < length; i++) {
      const byte = chunk[i]!;
      if (byte >= 250) continue; // uniform over 0..249 → geen bias bij % 10
      result += (byte % 10).toString();
    }
  }
  return result;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
