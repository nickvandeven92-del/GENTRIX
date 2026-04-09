/**
 * Genereert maskable PWA-iconen (éénmalig of na aanpassen van het SVG-sjabloon).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "public", "icons");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#18181b"/>
  <path fill="#fafafa" d="M128 160h256v48H128V160zm0 96h192v48H128v-48zm0 96h224v48H128v-48z"/>
</svg>`;

async function main() {
  await mkdir(iconsDir, { recursive: true });
  const buf = Buffer.from(svg);
  await sharp(buf).resize(192, 192).png().toFile(join(iconsDir, "icon-192.png"));
  await sharp(buf).resize(512, 512).png().toFile(join(iconsDir, "icon-512.png"));
  await sharp(buf).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));
  console.log("Wrote public/icons/icon-192.png, icon-512.png, apple-touch-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
