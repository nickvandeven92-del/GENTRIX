import { randomBytes, timingSafeEqual } from "crypto";

/** Genereert een niet-te-raden token voor `/site/{slug}?token=` (concept). */
export function generatePreviewSecret(): string {
  return randomBytes(24).toString("hex");
}

/** Constant-time vergelijking voor preview-token (UTF-8). Trim voor bestaande DB-waarden met spaties/newlines. */
export function previewSecretsEqual(stored: string | null | undefined, provided: string): boolean {
  const s = (stored ?? "").trim();
  const p = (provided ?? "").trim();
  if (s === "" || p === "") return false;
  try {
    const a = Buffer.from(s, "utf8");
    const b = Buffer.from(p, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
