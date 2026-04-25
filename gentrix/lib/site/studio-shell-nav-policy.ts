/**
 * Server-only beleid wanneer `config.studioShellNav === true` (moderne studio-shell).
 * Geen runtime-afhankelijkheid van prompt-library — alleen config + HTML-heuristiek.
 */
import { sliceFirstSiteChromeNavBlock } from "@/lib/ai/generate-site-postprocess";
import {
  isLegacyTailwindPageConfig,
  type MasterPromptPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { parseStudioNavChromeConfig } from "@/lib/site/render-studio-nav-chrome-html";
import type { StudioNavChromeConfig } from "@/lib/site/studio-nav-chrome-schema";

export function isStudioShellNavActive(pageConfig: TailwindPageConfig | null | undefined): boolean {
  if (!pageConfig || isLegacyTailwindPageConfig(pageConfig)) return false;
  return pageConfig.studioShellNav === true;
}

export type StudioShellNavResolveResult =
  | {
      mode: "shell";
      ok: true;
      studioNav: StudioNavChromeConfig;
      /** AI-chrome in secties terwijl shell actief is — wordt gestript; alleen signalering. */
      warnings: string[];
    }
  | { mode: "shell"; ok: false; errors: string[]; warnings: string[] };

/**
 * Bij `studioShellNav`: verplicht valide `config.studioNav` (geen infer uit AI-header).
 * Anders: `null` → roepende code gebruikt het bestaande parse + infer-pad.
 */
export function resolveStudioNavUnderShellPolicy(
  pageConfig: TailwindPageConfig | null | undefined,
  sections: readonly TailwindSection[],
): StudioShellNavResolveResult | null {
  if (!pageConfig || isLegacyTailwindPageConfig(pageConfig)) return null;
  if (!isStudioShellNavActive(pageConfig)) return null;

  const parsed = parseStudioNavChromeConfig(pageConfig.studioNav);
  if (!parsed) {
    return {
      mode: "shell",
      ok: false,
      errors: [
        "studioShellNav is true but config.studioNav is missing or invalid. Provide a valid studioNav object (brandLabel, items, …).",
      ],
      warnings: [],
    };
  }

  const warnings: string[] = [];
  for (const s of sections) {
    if (sliceFirstSiteChromeNavBlock(s.html)) {
      warnings.push(
        `studioShellNav: section "${s.sectionName}" still contains top-level site chrome (<header>, role=banner, or primary nav). It will be stripped in favour of the server shell.`,
      );
    }
  }

  return { mode: "shell", ok: true, studioNav: parsed, warnings };
}

/** Optioneel: admin/CI — strikte check zonder render. */
export function validateStudioShellNavConfig(pageConfig: MasterPromptPageConfig): string | null {
  if (!isStudioShellNavActive(pageConfig)) return null;
  const parsed = parseStudioNavChromeConfig(pageConfig.studioNav);
  if (!parsed) {
    return "studioShellNav is true but config.studioNav is missing or invalid.";
  }
  return null;
}
