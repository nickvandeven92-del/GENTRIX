import { createHash } from "crypto";

const IMG_SRC_RE = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;
const SRCSET_RE = /\bsrcset=["']([^"']+)["']/gi;

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

function extensionFromContentType(ct: string): string {
  const c = ct.toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  if (c.includes("svg")) return "svg";
  return "bin";
}

function extensionFromPath(url: string): string | null {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-z0-9]+)$/i);
    if (!m) return null;
    const e = m[1].toLowerCase();
    if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(e)) return e === "jpeg" ? "jpg" : e;
    return null;
  } catch {
    return null;
  }
}

function parseSrcsetUrls(srcset: string): string[] {
  const urls: string[] = [];
  for (const part of srcset.split(",")) {
    const token = part.trim().split(/\s+/)[0];
    if (token && (token.startsWith("http://") || token.startsWith("https://"))) {
      urls.push(token);
    }
  }
  return urls;
}

function collectRemoteImageUrls(html: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  IMG_SRC_RE.lastIndex = 0;
  while ((m = IMG_SRC_RE.exec(html)) !== null) {
    const u = m[1].trim();
    if (u.startsWith("http://") || u.startsWith("https://")) set.add(u);
  }
  SRCSET_RE.lastIndex = 0;
  while ((m = SRCSET_RE.exec(html)) !== null) {
    for (const u of parseSrcsetUrls(m[1])) set.add(u);
  }
  return [...set];
}

export type BundledImageFile = { zipPath: string; data: Buffer };

/**
 * Download http(s) image-URL's uit HTML en herschrijf naar images/img-….ext
 */
export async function bundleRemoteImagesForExport(html: string): Promise<{
  html: string;
  images: BundledImageFile[];
}> {
  const urls = collectRemoteImageUrls(html);
  if (urls.length === 0) {
    return { html, images: [] };
  }

  const urlToZipPath = new Map<string, string>();
  const images: BundledImageFile[] = [];

  for (const url of urls) {
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    } catch {
      clearTimeout(timer);
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) continue;

    const ct = res.headers.get("content-type") ?? "";
    const extFromPath = extensionFromPath(url);
    const ext = extFromPath ?? extensionFromContentType(ct);
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 14);
    const zipPath = `images/img-${hash}.${ext}`;
    urlToZipPath.set(url, zipPath);
    images.push({ zipPath, data: buf });
  }

  let out = html;
  for (const [url, zipPath] of urlToZipPath) {
    out = out.split(url).join(zipPath);
  }

  return { html: out, images };
}
