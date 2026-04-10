import type { PublicSiteModuleId } from "@/lib/site/public-site-modules-registry";
import {
  getPublicSiteModuleDefinition,
  STUDIO_DATA_ATTR_FEATURE_ZONE,
  STUDIO_DATA_ATTR_MODULE,
  STUDIO_DATA_ATTR_MODULE_CTA,
  STUDIO_DATA_ATTR_MODULE_LINK,
  STUDIO_DATA_ATTR_NAV_MODULE,
} from "@/lib/site/public-site-modules-registry";

const FEATURE_ZONE_PARENT_TAGS = ["section", "div", "article", "aside"] as const;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Verwijdert gelabelde publieke module-UI voor inactieve modules (zones, ankers, nav, CTA).
 * Geen layout-oplossing op IR-niveau: pure HTML-string, generator-gestuurde attributen.
 */
export function stripInactivePublicModuleMarkupFromHtml(
  html: string,
  inactiveModuleIds: ReadonlySet<PublicSiteModuleId>,
): string {
  let out = html;
  for (const id of inactiveModuleIds) {
    const def = getPublicSiteModuleDefinition(id);
    if (!def) continue;
    if (def.strip.featureZones) out = stripFeatureZonesForModule(out, id);
    if (def.strip.moduleAnchors) {
      out = stripElementsWithDataAttr(out, "a", STUDIO_DATA_ATTR_MODULE, id);
      out = stripElementsWithDataAttr(out, "a", STUDIO_DATA_ATTR_MODULE_LINK, id);
    }
    if (def.strip.navAnchors) {
      out = stripElementsWithDataAttr(out, "a", STUDIO_DATA_ATTR_NAV_MODULE, id);
    }
    if (def.strip.ctaElements) {
      out = stripElementsWithDataAttr(out, "a", STUDIO_DATA_ATTR_MODULE_CTA, id);
      out = stripElementsWithDataAttr(out, "button", STUDIO_DATA_ATTR_MODULE_CTA, id);
    }
  }
  out = stripEmptyListItems(out);
  return out;
}

function stripElementsWithDataAttr(
  html: string,
  tagName: "a" | "button",
  attrName: string,
  moduleId: PublicSiteModuleId,
): string {
  const attr = escapeAttrForRegex(attrName);
  const mid = escapeRe(moduleId);
  const re = new RegExp(
    `<${tagName}\\b[^>]*\\b${attr}\\s*=\\s*(["'])${mid}\\1[^>]*>[\\s\\S]*?<\\/${tagName}>`,
    "gi",
  );
  return html.replace(re, "");
}

function escapeAttrForRegex(attr: string): string {
  return attr.replace(/-/g, "\\-");
}

function stripFeatureZonesForModule(html: string, moduleId: PublicSiteModuleId): string {
  let out = html;
  let changed = true;
  const mid = escapeRe(moduleId);
  const attr = escapeAttrForRegex(STUDIO_DATA_ATTR_FEATURE_ZONE);
  while (changed) {
    changed = false;
    for (const tag of FEATURE_ZONE_PARENT_TAGS) {
      const openRe = new RegExp(
        `<${tag}\\b[^>]*\\b${attr}\\s*=\\s*(["'])${mid}\\1[^>]*>`,
        "i",
      );
      const m = openRe.exec(out);
      if (m == null || m.index === undefined) continue;
      const start = m.index;
      const afterOpen = start + m[0].length;
      const end = findClosingTagEnd(out, tag, afterOpen);
      if (end > afterOpen) {
        out = out.slice(0, start) + out.slice(end);
        changed = true;
        break;
      }
    }
  }
  return out;
}

function findClosingTagEnd(html: string, rawTag: string, from: number): number {
  const tag = rawTag.toLowerCase();
  const openRe = new RegExp(`<${tag}\\b`, "gi");
  const closeRe = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 1;
  let pos = from;
  while (pos < html.length && depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const om = openRe.exec(html);
    const cm = closeRe.exec(html);
    const oi = om?.index ?? Infinity;
    const ci = cm?.index ?? Infinity;
    if (ci === Infinity) return -1;
    if (oi < ci) {
      depth++;
      pos = oi + 1;
    } else {
      depth--;
      if (depth === 0) return ci + cm![0].length;
      pos = ci + cm![0].length;
    }
  }
  return -1;
}

function stripEmptyListItems(html: string): string {
  return html.replace(/<li\b[^>]*>\s*<\/li>/gi, "");
}

/** Ruimt interne compose-attributen op (geen bezoeker-metadata). */
export function stripPublicSiteComposeDataAttributesFromHtml(html: string): string {
  let h = html;
  const names = [
    STUDIO_DATA_ATTR_FEATURE_ZONE,
    STUDIO_DATA_ATTR_NAV_MODULE,
    STUDIO_DATA_ATTR_MODULE_CTA,
    STUDIO_DATA_ATTR_MODULE,
    STUDIO_DATA_ATTR_MODULE_LINK,
  ];
  for (const name of names) {
    const escaped = escapeAttrForRegex(name);
    const re = new RegExp(`\\s*\\b${escaped}\\s*=\\s*(["'])[^"']*\\1`, "gi");
    h = h.replace(re, "");
  }
  return h;
}
