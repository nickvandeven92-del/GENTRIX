#!/usr/bin/env node
/**
 * Wrapper: `node scripts/render-remotion.mjs [composition] [output.mp4]`
 * Default: StudioPromo → out/remotion/studio-promo.mp4
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const composition = process.argv[2] || "StudioPromo";
const outFile = process.argv[3] || path.join("out", "remotion", "studio-promo.mp4");
const outDir = path.dirname(path.join(root, outFile));
fs.mkdirSync(outDir, { recursive: true });

const cmd = `npx remotion render remotion/index.ts ${composition} "${outFile}"`;
execSync(cmd, { stdio: "inherit", cwd: root });
