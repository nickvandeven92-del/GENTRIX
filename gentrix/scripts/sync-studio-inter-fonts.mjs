/**
 * Kopieert variable Inter woff2 van `@fontsource-variable/inter` naar `public/fonts/`.
 * Run na upgrade van het font-pakket: `npm run fonts:sync-inter`
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const pub = join(root, "public", "fonts");
const srcDir = join(root, "node_modules", "@fontsource-variable", "inter", "files");
const files = ["inter-latin-wght-normal.woff2", "inter-latin-ext-wght-normal.woff2"];

mkdirSync(pub, { recursive: true });
for (const f of files) {
  const from = join(srcDir, f);
  const to = join(pub, f);
  if (!existsSync(from)) {
    console.error("[fonts:sync-inter] Ontbreekt:", from, "— installeer @fontsource-variable/inter (devDependency).");
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log("[fonts:sync-inter] OK", to);
}
