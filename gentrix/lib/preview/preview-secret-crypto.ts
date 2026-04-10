import { randomBytes, timingSafeEqual } from "node:crypto";

/** Genereert een niet-te-raden token voor `/site/{slug}?token=` (concept). */
export function generatePreviewSecret(): string {
  return randomBytes(24).toString("hex");
}

/** Constant-time vergelijking voor preview-token (UTF-8). */
export function previewSecretsEqual(stored: string | null | undefined, provided: string): boolean {
  if (stored == null || stored === "" || provided === "") return false;
  try {
    const a = Buffer.from(stored, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
