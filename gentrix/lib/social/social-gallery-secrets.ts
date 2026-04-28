import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "encv1";

function keyFromSecret(): Buffer | null {
  const secret = process.env.SOCIAL_GALLERY_TOKEN_SECRET?.trim() ?? "";
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function encryptSocialToken(token: string): string | null {
  const key = keyFromSecret();
  const plain = token.trim();
  if (!key || !plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSocialToken(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const key = keyFromSecret();
  if (!key) return null;
  const [prefix, ivB64, tagB64, dataB64] = payload.split(":");
  if (prefix !== PREFIX || !ivB64 || !tagB64 || !dataB64) return null;
  try {
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return decrypted.trim() || null;
  } catch {
    return null;
  }
}
