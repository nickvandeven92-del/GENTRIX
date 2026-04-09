import type { ClaudeTailwindPageOutput } from "@/lib/ai/tailwind-sections-schema";

function sectionNameToStableId(sectionName: string, index: number): string {
  const base = sectionName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base.length > 0 ? base : `section-${index + 1}`;
}

/** Unieke id's voor upgrade-prompt (zelfde basis als sectienaam-slug, plus -2, -3 bij botsingen). */
export function stableIdsForUpgradeSections(sectionNames: string[]): string[] {
  const used = new Set<string>();
  return sectionNames.map((name, i) => {
    let base = sectionNameToStableId(name, i);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  });
}

const ROOT_TAGS_WITH_ID = new Set([
  "section",
  "article",
  "main",
  "header",
  "div",
  "nav",
  "footer",
]);

function slugifyIdSegment(raw: string): string {
  const t = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return t.length > 0 ? t : "section";
}

/** Zorgt voor unieke JSON-`id`'s (dubbele model-output). */
export function ensureUniqueSectionIds(
  sections: ClaudeTailwindPageOutput["sections"],
): ClaudeTailwindPageOutput["sections"] {
  const used = new Set<string>();
  return sections.map((row, index) => {
    let base = slugifyIdSegment(row.id || row.name || `section-${index + 1}`);
    let id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return { ...row, id };
  });
}

/**
 * Zet `id` op het eerste root-element (meestal `<section>`) gelijk aan de JSON-sectie-id.
 */
export function withRootIdOnSectionHtml(html: string, stableId: string): string {
  const q = stableId.replace(/"/g, "&quot;");
  const idAttrPattern = /\bid\s*=\s*["']([^"']*)["']/i;
  return html.replace(
    /^\s*<([a-zA-Z][\w:-]*)(\s[^>]*)?>/,
    (full, tag: string, attrs: string | undefined) => {
      const t = tag.toLowerCase();
      if (!ROOT_TAGS_WITH_ID.has(t)) {
        return full;
      }
      const a = attrs ?? "";
      const idMatch = a.match(idAttrPattern);
      if (idMatch) {
        if (idMatch[1] === stableId) {
          return full;
        }
        const na = a.replace(idAttrPattern, ` id="${q}"`);
        return `<${tag}${na}>`;
      }
      return `<${tag} id="${q}"${a}>`;
    },
  );
}

/**
 * Voegt meerdere \`class="…"\` op dezelfde \`<nav>\` of \`<header>\` samen tot één attribuut (geldige HTML).
 * Claude combineert soms scroll-overlay + vaste utilities tot twee \`class\`-attributen.
 */
export function mergeDuplicateClassOnChromeTags(html: string): string {
  return html.replace(/<(nav|header)(\s[^>]*?)>/gi, (full, tag: string, inner: string) => {
    const doubleQuoted = [...inner.matchAll(/\bclass\s*=\s*"([^"]*)"/gi)];
    const singleQuoted = [...inner.matchAll(/\bclass\s*=\s*'([^']*)'/gi)];
    if (doubleQuoted.length + singleQuoted.length < 2) {
      return full;
    }
    const parts: string[] = [];
    for (const m of doubleQuoted) {
      for (const p of m[1].split(/\s+/).filter(Boolean)) {
        parts.push(p);
      }
    }
    for (const m of singleQuoted) {
      for (const p of m[1].split(/\s+/).filter(Boolean)) {
        parts.push(p);
      }
    }
    const merged = [...new Set(parts)].join(" ");
    const without = inner
      .replace(/\bclass\s*=\s*"[^"]*"/gi, " ")
      .replace(/\bclass\s*=\s*'[^']*'/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const newInner = without.length > 0 ? `class="${merged}" ${without}` : `class="${merged}"`;
    return `<${tag} ${newInner}>`;
  });
}

function pickFallbackFragment(validIds: Set<string>): string {
  for (const k of ["footer", "contact", "hero", "features", "faq"]) {
    if (validIds.has(k)) return k;
  }
  const first = [...validIds].find((x) => x !== "top");
  return first ?? "footer";
}

/**
 * Vervangt `href="#onbekend"` door een geldige anker-id uit de pagina.
 */
export function repairInternalLinksInHtml(html: string, validIds: Set<string>): string {
  const fb = pickFallbackFragment(validIds);
  return html.replace(/href\s*=\s*(["'])(#[^"']*)\1/gi, (_m, quote: string, ref: string) => {
    const inner = ref.slice(1);
    const frag = inner.split(/[?#]/)[0] ?? "";
    if (frag === "") {
      return `href=${quote}#${fb}${quote}`;
    }
    if (frag === "top" || validIds.has(frag)) {
      return `href=${quote}#${frag}${quote}`;
    }
    return `href=${quote}#${fb}${quote}`;
  });
}

const HERO_VIEWPORT_MIN_CLASS = "min-h-[72vh] md:min-h-[80vh]";

/** `min-h-0` telt niet als viewport-hoogte voor de hero (layout-truc). */
function hasHeroViewportMinHeightClass(classStr: string): boolean {
  const tokens = classStr.split(/\s+/).filter(Boolean);
  return tokens.some((t) => {
    if (t === "min-h-0") return false;
    return /^min-h-/.test(t);
  });
}

/**
 * Voegt minimale hero-viewport-hoogte toe als het model geen `min-h-*` (behalve min-h-0) zette.
 * Voorkomt het patroon: smalle gekleurde strook + groot leeg wit gebied in het iframe.
 */
export function ensureHeroRootMinViewportClass(html: string): string {
  return html.replace(
    /^\s*<([a-zA-Z][\w:-]*)(\s[^>]*)>/,
    (full, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!ROOT_TAGS_WITH_ID.has(t)) return full;
      const classMatch = attrs.match(/\bclass\s*=\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/i);
      if (classMatch) {
        const quote = classMatch[1];
        const existing = classMatch[2].replace(/\\(.)/g, "$1");
        if (hasHeroViewportMinHeightClass(existing)) return full;
        const merged = `${existing} ${HERO_VIEWPORT_MIN_CLASS}`.trim();
        const newAttrs = attrs.replace(classMatch[0], `class=${quote}${merged}${quote}`);
        return `<${tag}${newAttrs}>`;
      }
      const trimmed = attrs.trim();
      const sp = trimmed.length ? " " : "";
      return `<${tag}${sp}${trimmed} class="${HERO_VIEWPORT_MIN_CLASS}">`;
    },
  );
}

/**
 * Na Zod-validatie: stabiele id's, root-id in markup, werkende interne links.
 */
export function postProcessClaudeTailwindPage(page: ClaudeTailwindPageOutput): ClaudeTailwindPageOutput {
  const withIds = ensureUniqueSectionIds(page.sections);
  const validIds = new Set(withIds.map((s) => s.id));
  validIds.add("top");

  const sectionsLinked = withIds.map((row) => {
    const html0 = withRootIdOnSectionHtml(row.html, row.id);
    const html1 = repairInternalLinksInHtml(html0, validIds);
    const html2 = mergeDuplicateClassOnChromeTags(html1);
    const html3 = row.id === "hero" ? ensureHeroRootMinViewportClass(html2) : html2;
    return { ...row, html: html3 };
  });

  return { ...page, sections: sectionsLinked };
}

/** Alleen voor upgrade-prompt JSON (kleinere payload). */
export function normalizeHtmlWhitespaceForUpgradePrompt(html: string): string {
  return html.replace(/[\t\n\r]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
