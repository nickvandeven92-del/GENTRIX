import { SNAPSHOT_TAILWIND_COMPILED_CSS_MAX } from "@/lib/site/project-snapshot-constants";

/**
 * CSS uit vertrouwde Tailwind-build toch begrenzen + breakout voorkomen vóór embed in `<style>`.
 */
export function sanitizeCompiledTailwindCssForStyleTag(css: string): string {
  let s = css.length > SNAPSHOT_TAILWIND_COMPILED_CSS_MAX ? css.slice(0, SNAPSHOT_TAILWIND_COMPILED_CSS_MAX) : css;
  s = s.replace(/<\/style/gi, "\\3c/style");
  s = s.replace(/@import\b[\s\S]*?;/gi, "/* @import verwijderd */");
  s = s.replace(/@import\b[\s\S]*$/gi, "/* @import verwijderd */");
  s = s.replace(/expression\s*\(/gi, "blocked(");
  s = s.replace(/javascript\s*:/gi, "blocked:");
  s = s.replace(/-moz-binding\s*:/gi, "blocked:");
  s = s.replace(/behavior\s*:/gi, "blocked:");
  return s;
}
