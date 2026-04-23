import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { randomUUID } from "crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { GeneratedLogoSet } from "@/types/logo";
import { buildStandaloneExportHtmlDocument } from "@/lib/site/build-standalone-export-html";

const execFileAsync = promisify(execFile);

const TW_INPUT = `@import "tailwindcss";
@source "./index.html";
`;

/** Resolveert de Tailwind v4 CLI-entry; `createRequire` helpt de Next output-tracer + Vercel runtime. */
function resolveTailwindCliMjs(projectRoot: string): string {
  try {
    const req = createRequire(path.join(projectRoot, "package.json"));
    const pkgJson = req.resolve("@tailwindcss/cli/package.json") as string;
    return path.join(path.dirname(pkgJson), "dist", "index.mjs");
  } catch {
    return path.join(projectRoot, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs");
  }
}

/** CLI-build tegen bestaande `index.html` (zoals na image-bundling in ZIP-export). */
export async function buildTailwindCompiledCssFromIndexHtml(projectRoot: string, indexHtml: string): Promise<string> {
  const workDir = path.join(projectRoot, ".tmp", `tailwind-compile-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    await fs.writeFile(path.join(workDir, "index.html"), indexHtml, "utf8");
    await fs.writeFile(path.join(workDir, "tw-input.css"), TW_INPUT, "utf8");

    const cliJs = resolveTailwindCliMjs(projectRoot);
    await fs.access(cliJs);
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
  /** Optioneel; anders stabiele placeholder voor favicon in compile-HTML. */
  faviconIdentity?: { displayName: string; slug: string };
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
      faviconIdentity: input.faviconIdentity ?? {
        displayName: input.docTitle,
        slug: "tailwind-compile",
      },
    },
  );
  return buildTailwindCompiledCssFromIndexHtml(input.projectRoot, html);
}
