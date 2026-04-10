import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildStandaloneExportHtmlDocument } from "@/lib/site/build-standalone-export-html";

const execFileAsync = promisify(execFile);

const TW_INPUT = `@import "tailwindcss";
@source "./index.html";
`;

/** CLI-build tegen bestaande `index.html` (zoals na image-bundling in ZIP-export). */
export async function buildTailwindCompiledCssFromIndexHtml(projectRoot: string, indexHtml: string): Promise<string> {
  const workDir = path.join(projectRoot, ".tmp", `tailwind-compile-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    await fs.writeFile(path.join(workDir, "index.html"), indexHtml, "utf8");
    await fs.writeFile(path.join(workDir, "tw-input.css"), TW_INPUT, "utf8");

    const cliJs = path.join(projectRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");
    await execFileAsync(process.execPath, [cliJs, "build", "-i", "tw-input.css", "-o", "styles.css", "-m"], {
      cwd: workDir,
      env: { ...process.env },
      maxBuffer: 12 * 1024 * 1024,
    });

    return await fs.readFile(path.join(workDir, "styles.css"), "utf8");
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export type BuildTailwindCompiledCssInput = {
  projectRoot: string;
  sections: TailwindSection[];
  pageConfig: TailwindPageConfig | null | undefined;
  docTitle: string;
  customCss?: string;
  customJs?: string;
  logoSet?: GeneratedLogoSet | null;
};

/**
 * Draait `@tailwindcss/cli` tegen `index.html` (zelfde markup-pad als FTP-export vóór image-bundle).
 */
export async function buildTailwindCompiledCssBundle(input: BuildTailwindCompiledCssInput): Promise<string> {
  const html = buildStandaloneExportHtmlDocument(
    input.sections,
    input.pageConfig,
    input.docTitle,
    "local_css",
    {
      css: input.customCss,
      js: input.customJs,
      logoSet: input.logoSet ?? undefined,
    },
  );
  return buildTailwindCompiledCssFromIndexHtml(input.projectRoot, html);
}
