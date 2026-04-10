import {
  PUBLIC_SITE_MODULE_DEFINITIONS,
  STUDIO_DATA_ATTR_MODULE,
} from "@/lib/site/public-site-modules-registry";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Koppelt studio-pad-placeholders aan een module-id via `data-studio-module` (en herkent legacy
 * `data-studio-module-link`) zodat strip/compose generiek kan werken.
 */
export function ensureStudioModuleMarkersOnAnchors(html: string): string {
  let h = html;
  for (const def of PUBLIC_SITE_MODULE_DEFINITIONS) {
    h = tagPlaceholderAnchors(h, def.pathPlaceholder, def.id);
  }
  return h;
}

function tagPlaceholderAnchors(html: string, placeholder: string, moduleId: string): string {
  const ph = escapeRe(placeholder);
  const re = new RegExp(
    `<a(?![^>]*\\b(?:data-studio-module|data-studio-module-link)\\s*=)([^>]*\\bhref\\s*=\\s*(["'])${ph}\\2[^>]*)>`,
    "gi",
  );
  return html.replace(
    re,
    (_m, inner: string) => `<a ${STUDIO_DATA_ATTR_MODULE}="${moduleId}"${inner}>`,
  );
}
