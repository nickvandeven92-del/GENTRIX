import type {
  ClaudeTailwindMarketingSiteOutput,
  ClaudeTailwindPageOutput,
  GeneratedTailwindPage,
  MasterPromptPageConfig,
  TailwindPageConfig,
  TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { isLegacyTailwindPageConfig, slugifyToSectionId } from "@/lib/ai/tailwind-sections-schema";
import { DEFAULT_SERVICE_MARKETING_SLUGS, marketingPageNavLabel } from "@/lib/ai/marketing-page-slugs";
import {
  STUDIO_CONTACT_PATH_PLACEHOLDER,
  STUDIO_SITE_BASE_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";
import {
  cleanupStrippedStockMarkup,
  stripAllUnsplashPhotoUrlsInHtml,
} from "@/lib/ai/strip-unsplash-urls";
import { replaceAllOpenTagsByLocalName } from "@/lib/site/html-open-tag";

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
    const base = sectionNameToStableId(name, i);
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
    const base = slugifyIdSegment(row.id || row.name || `section-${index + 1}`);
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
/**
 * Modellen zetten soms per ongeluk `open: true` / `menuOpen: true` in `x-data`, waardoor het mobiele menu
 * fullscreen opent vóór interactie. Corrigeer bekende toggles naar `false` (alleen binnen `x-data`-waarden).
 */
export const ALPINE_NAV_TOGGLE_KEYS = [
  "open",
  "menuOpen",
  "navOpen",
  "mobileOpen",
  "mOpen",
  "nmOpen",
  "showMenu",
  "drawerOpen",
  "sidebarOpen",
  "panelOpen",
  "mobileNavOpen",
  "sideMenuOpen",
  "isOpen",
  "showNav",
  "mobileMenuOpen",
  "showMobileMenu",
  "showMobileNav",
  "sheetOpen",
  "burgerOpen",
  "isMenuOpen",
  "navDrawerOpen",
  "menuExpanded",
  "overlayOpen",
  "overlayVisible",
  "navMenuOpen",
  "primaryNavOpen",
  "hamburgerOpen",
  "offCanvasOpen",
  "navigationOpen",
  "mobileNavVisible",
  "flyoutOpen",
  "compactMenuOpen",
] as const;

const ALPINE_NAV_TOGGLE_TRUE_RE = new RegExp(
  `\\b(${ALPINE_NAV_TOGGLE_KEYS.join("|")})\\s*:\\s*true\\b`,
  "g",
);

export function fixAlpineNavToggleDefaultsInXData(html: string): string {
  const fixInner = (inner: string) => inner.replace(ALPINE_NAV_TOGGLE_TRUE_RE, "$1: false");
  let out = html.replace(/\bx-data\s*=\s*"([^"]*)"/gi, (full, inner: string) => {
    const next = fixInner(inner);
    return next === inner ? full : `x-data="${next}"`;
  });
  out = out.replace(/\bx-data\s*=\s*'([^']*)'/gi, (full, inner: string) => {
    const next = fixInner(inner);
    return next === inner ? full : `x-data='${next}'`;
  });
  return out;
}

function escapeRegExpKey(k: string): string {
  return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `x-show`-expressie gebruikt bekende nav-toggle (incl. losse `open`). */
function xShowExpressionUsesNavToggle(expr: string): boolean {
  const e = expr.trim();
  if (!e) return false;
  for (const k of ALPINE_NAV_TOGGLE_KEYS) {
    if (new RegExp(`\\b${escapeRegExpKey(k)}\\b`).test(e)) return true;
  }
  return /\bopen\b/.test(e);
}

function extractFirstNavToggleKeyFromXDataScope(html: string): string | null {
  for (const k of ALPINE_NAV_TOGGLE_KEYS) {
    const re = new RegExp(`\\b${escapeRegExpKey(k)}\\s*:`, "i");
    if (re.test(html)) return k;
  }
  return null;
}

function extractFirstNavToggleKeyFromInteractiveMarkup(html: string): string | null {
  for (const k of ALPINE_NAV_TOGGLE_KEYS) {
    const key = escapeRegExpKey(k);
    const inClick = new RegExp(`(?:@click|x-on:click)\\s*=\\s*["'][^"']*\\b${key}\\b[^"']*["']`, "i");
    if (inClick.test(html)) return k;
    const inShow = new RegExp(`\\bx-show\\s*=\\s*["'][^"']*\\b${key}\\b[^"']*["']`, "i");
    if (inShow.test(html)) return k;
  }
  return null;
}

function shouldLogRepairBrokenMobileDrawer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as Window & { __gentrixDebugMobileDrawerRepair?: boolean };
    if (w.__gentrixDebugMobileDrawerRepair === true) return true;
    return /(?:\?|&)debugRepairMobileDrawer=1(?:&|$)/.test(window.location.search);
  } catch {
    return false;
  }
}

function logRepairBrokenMobileDrawer(...args: unknown[]): void {
  if (!shouldLogRepairBrokenMobileDrawer()) return;
  console.log(...args);
}

function classLooksLikeSideDrawer(cls: string): boolean {
  if (!/\bfixed\b/i.test(cls)) return false;
  if (!/\b(?:right-0|left-0)\b/i.test(cls)) return false;
  return (
    /\bh-full\b/i.test(cls) ||
    /\binset-y-0\b/i.test(cls) ||
    (/\btop-0\b/i.test(cls) && /\bbottom-0\b/i.test(cls))
  );
}

const KNOWN_BROKEN_MOBILE_DRAWER_CLASS =
  "fixed top-0 right-0 h-full w-72 bg-[#08081a] z-[70] flex flex-col px-8 pt-24 pb-10 shadow-2xl border-l border-white/5";

function wireKnownBrokenDrawerClass(html: string, stateKey: string): string {
  const classRe = escapeRegExpKey(KNOWN_BROKEN_MOBILE_DRAWER_CLASS);
  const re = new RegExp(
    `<(div|aside|nav)\\b([^>]*\\bclass\\s*=\\s*["']${classRe}["'][^>]*)>`,
    "gi",
  );
  return html.replace(re, (full, tag: string, attrs: string) => {
    if (/\bx-show\s*=/i.test(attrs)) return full;
    const withCloak = /\bx-cloak\b/i.test(attrs) ? attrs : `${attrs} x-cloak`;
    const withStop = /@click\.stop(?:\s*=|\b)/i.test(withCloak) ? withCloak : `${withCloak} @click.stop`;
    return `<${tag}${withStop} x-show="${stateKey}">`;
  });
}

function findSideDrawerOpenTagIndex(html: string): number {
  const re = /<(div|aside|nav)\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[2] ?? "";
    const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    if (classLooksLikeSideDrawer(cls)) return m.index;
  }
  return -1;
}

function htmlHasSideDrawerElement(html: string): boolean {
  return findSideDrawerOpenTagIndex(html) >= 0;
}

function menuButtonHintScore(attrs: string): number {
  let score = 0;
  if (/\b(?:sm|md|lg|xl|2xl):hidden\b/i.test(attrs)) score += 6;
  if (/\baria-label\s*=\s*["'][^"']*(?:menu|enu|hamburger|burger|open|openen|sluit|close|navigat)/i.test(attrs)) {
    score += 6;
  }
  if (/\baria-controls\s*=\s*["'][^"']*(?:mobile|menu|drawer|sheet|nav)/i.test(attrs)) score += 6;
  if (/\bclass\s*=\s*["'][^"']*(?:menu|hamburger|burger|nav-toggle|drawer-toggle|mobile-toggle)[^"']*["']/i.test(attrs)) {
    score += 5;
  }
  if (
    /\bclass\s*=\s*["'][^"']*(?:\bh-(?:8|9|10|11|12)\b|\bw-(?:8|9|10|11|12)\b|\bsize-(?:8|9|10|11|12)\b|\baspect-square\b)[^"']*["']/i.test(
      attrs,
    )
  ) {
    score += 2;
  }
  if (/\btype\s*=\s*["']button["']/i.test(attrs)) score += 1;
  return score;
}

function pickMenuButtonOrdinalCandidates(scopeHtml: string, buttonMatches: RegExpMatchArray[]): Set<number> {
  const out = new Set<number>();
  if (buttonMatches.length === 0) return out;
  const scored = buttonMatches.map((m, ordinal) => ({
    ordinal,
    attrs: m[1] ?? "",
    index: m.index ?? -1,
    score: menuButtonHintScore(m[1] ?? ""),
  }));

  const strong = scored.filter((r) => r.score >= 6);
  if (strong.length > 0) {
    for (const row of strong) out.add(row.ordinal);
    return out;
  }

  const likely = scored.filter((r) => r.score >= 3);
  if (likely.length > 0) {
    const topScore = Math.max(...likely.map((r) => r.score));
    for (const row of likely) {
      if (row.score === topScore) out.add(row.ordinal);
    }
    return out;
  }

  const drawerIdx = findSideDrawerOpenTagIndex(scopeHtml);
  if (drawerIdx >= 0) {
    const beforeDrawer = scored.filter((r) => r.index >= 0 && r.index < drawerIdx);
    if (beforeDrawer.length === 1) {
      out.add(beforeDrawer[0]!.ordinal);
      return out;
    }
    if (beforeDrawer.length > 1) {
      const iconSized = beforeDrawer.filter((r) =>
        /\b(?:\bh-(?:8|9|10|11|12)\b|\bw-(?:8|9|10|11|12)\b|\bsize-(?:8|9|10|11|12)\b|\baspect-square\b)/i.test(r.attrs),
      );
      if (iconSized.length > 0) {
        const pick = iconSized[iconSized.length - 1]!;
        out.add(pick.ordinal);
        return out;
      }
    }
  }

  if (scored.length === 1) out.add(0);
  return out;
}

function injectNavStateScope(html: string, stateKey: string): string {
  const scopeAttrs = ` x-data="{ ${stateKey}: false }" @keydown.escape.window="${stateKey} = false"`;
  let out = html.replace(
    /<header\b((?:(?!\bx-data\s*=)[^>])*)>/i,
    `<header$1${scopeAttrs}>`,
  );
  if (out !== html) return out;
  out = html.replace(
    /<section\b((?:(?!\bx-data\s*=)[^>])*)>/i,
    `<section$1${scopeAttrs}>`,
  );
  if (out !== html) return out;
  return html.replace(
    /<(div|nav|aside|main|article)\b((?:(?!\bx-data\s*=)[^>])*)>/i,
    (full, tag: string, attrs: string) => `<${tag}${attrs}${scopeAttrs}>`,
  );
}

function repairBrokenMobileDrawerInScope(scopeHtml: string): string {
  const hasSideDrawer = htmlHasSideDrawerElement(scopeHtml);
  if (!hasSideDrawer) return scopeHtml;

  const buttonMatches = [...scopeHtml.matchAll(/<button\b([^>]*)>/gi)];
  const buttonCandidates = pickMenuButtonOrdinalCandidates(scopeHtml, buttonMatches);
  if (buttonCandidates.size === 0) return scopeHtml;

const stateKey =
  extractFirstNavToggleKeyFromXDataScope(scopeHtml) ??
  extractFirstNavToggleKeyFromInteractiveMarkup(scopeHtml) ??
  // Zoek ook direct in x-show op drawer elementen
  ALPINE_NAV_TOGGLE_KEYS.find((k) => 
    new RegExp(`x-show\\s*=\\s*["']${k}["']`).test(scopeHtml)
  ) ??
  "navOpen";
  let out = scopeHtml;

  /** Zorg voor een scope als er nergens een bruikbare x-data state staat. */
  if (!extractFirstNavToggleKeyFromXDataScope(out)) {
    out = injectNavStateScope(out, stateKey);
  }

  /** Voeg @click toggle toe op menuknop als die ontbreekt. */
  let buttonIdx = -1;
  out = out.replace(/<button\b([^>]*)>/gi, (full, attrs: string) => {
    buttonIdx += 1;
    if (!buttonCandidates.has(buttonIdx)) return full;
    if (/(?:@click|x-on:click)\s*=/.test(attrs)) return full;
    const expandedAttr = /\baria-expanded\s*=/.test(attrs) ? "" : ` :aria-expanded="${stateKey}.toString()"`;
    return `<button${attrs} @click="${stateKey} = !${stateKey}"${expandedAttr}>`;
  });

  /** Drawer-debug: laat exact zien of de bekende `fixed top-0 right-0`-tag in scope zit. */
  const drawerTagMatch = out.match(/<div[^>]*class="fixed top-0 right-0[^"]*"[^>]*>/i);
  logRepairBrokenMobileDrawer("[repair drawer] match:", drawerTagMatch?.[0] ?? null);

  /** Voeg x-show toe op side-drawer als die ontbreekt. */
  const beforeDrawerReplace = out;
  /** Snelle, exacte fix voor het bekende broken-drawer klassepatroon uit logs. */
  out = wireKnownBrokenDrawerClass(out, stateKey);
  out = out.replace(/<(div|aside|nav)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    if (!classLooksLikeSideDrawer(cls)) return full;
    if (/\bx-show\s*=/i.test(attrs)) return full;
    const withCloak = /\bx-cloak\b/i.test(attrs) ? attrs : `${attrs} x-cloak`;
    const withStop = /@click\.stop(?:\s*=|\b)/i.test(withCloak) ? withCloak : `${withCloak} @click.stop`;
    return `<${tag}${withStop} x-show="${stateKey}">`;
  });
  logRepairBrokenMobileDrawer("[repair drawer] changed:", out !== beforeDrawerReplace);

  /** Voeg x-show toe op backdrop-laag als die ontbreekt. */
  out = out.replace(/<div\b([^>]*)>/gi, (full, attrs: string) => {
    const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    const isBackdrop =
      /\bfixed\b/.test(cls) &&
      /\binset-0\b/.test(cls) &&
      /bg-(?:black|slate|zinc|neutral|gray)|bg-\[rgba|backdrop|opacity-\d+/i.test(cls);
    if (!isBackdrop) return full;
    if (/\bx-show\s*=/.test(attrs)) return full;
    const withCloak = /\bx-cloak\b/.test(attrs) ? attrs : `${attrs} x-cloak`;
    const withClose = /@click\s*=/.test(withCloak) ? withCloak : `${withCloak} @click="${stateKey} = false"`;
    return `<div${withClose} x-show="${stateKey}">`;
  });

  return out;
}

/** Geen `dark:` op de strepen: bij lichte header + system dark kan `dark:bg-*` witte streepjes op wit geven. */
function buildGentrixHamburgerFallbackInner(headerHtml: string, buttonAttrs: string): string {
  const blob = `${headerHtml}\n${buttonAttrs}`;
  const looksDarkNav =
    /\bbg-(?:stone|zinc|slate|neutral)-(8|9)00\b/i.test(blob) ||
    /\bbg-black\b/i.test(blob) ||
    /\bbg-\[#0/i.test(blob);
  const looksLightNav =
    /\bbg-white\b/i.test(blob) ||
    /\bbg-stone-50\b/i.test(blob) ||
    /\bbg-zinc-50\b/i.test(blob) ||
    /\bbg-stone-100\b/i.test(blob);
  const bar = looksDarkNav && !looksLightNav
    ? "h-0.5 w-5 rounded-full bg-white/95 shadow-sm"
    : "h-0.5 w-5 rounded-full bg-neutral-900 shadow-sm";
  return `<span class="gentrix-hamburger-fallback pointer-events-none flex flex-col justify-center gap-[5px]" aria-hidden="true"><span class="${bar}"></span><span class="${bar}"></span><span class="${bar}"></span></span>`;
}

function isLikelyHeaderMobileMenuButton(attrs: string): boolean {
  if (menuButtonHintScore(attrs) >= 6) return true;
  return (
    /\b(?:lg|md|sm|xl):hidden\b/i.test(attrs) &&
    /\baria-label\s*=\s*["'][^"']*(?:menu|Menu|enu|hamburger)/i.test(attrs) &&
    /\bflex\b/i.test(attrs) &&
    /\bgap-/.test(attrs)
  );
}

/**
 * `repairBrokenMobileDrawer` pakt vooral **zij-drawers** (`fixed right-0 h-full`). Veel AI-headers gebruiken
 * een **top-sheet** (`x-show="navOpen"`) zonder side-drawer — dan bleef de hamburger leeg en/of zonder @click.
 * Repareert de eerste `<header>`: toggle + vaste streepjes als de knop inhoudloos is.
 */
export function repairHeaderMobileMenuButton(html: string): string {
  const headerRe = /<header\b[^>]*>[\s\S]*?<\/header>/i;
  const hm = html.match(headerRe);
  if (!hm || hm.index === undefined) return html;

  const fullHeader = hm[0];
  const probe = html.slice(0, Math.min(html.length, 120_000));
  const stateKey =
    extractFirstNavToggleKeyFromInteractiveMarkup(probe) ??
    extractFirstNavToggleKeyFromXDataScope(probe) ??
    "navOpen";

  let h = fullHeader;

  if (
    !/\bx-data\s*=/i.test(probe) &&
    /\bx-show\s*=\s*["'][^"']*\b(?:navOpen|menuOpen)\b/i.test(h)
  ) {
    h = injectNavStateScope(h, stateKey);
  }

  const next = h.replace(/<button(\b[^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs: string, inner: string) => {
    if (!isLikelyHeaderMobileMenuButton(attrs)) return full;
    if (/\bgentrix-menu-repaired\b/.test(attrs)) return full;

    const trimmed = inner.replace(/<!--[\s\S]*?-->/g, "").trim();
    if (trimmed.includes("gentrix-hamburger-fallback")) return full;

    const needsClick = !/(?:@click|x-on:click)\s*=/.test(attrs);
    const needsBars = trimmed.length === 0;
    if (!needsClick && !needsBars) return full;

    let nextAttrs = attrs;
    if (needsClick) {
      nextAttrs = `${nextAttrs} @click="${stateKey} = !${stateKey}"`;
      if (!/\baria-expanded\s*=/.test(nextAttrs)) {
        nextAttrs = `${nextAttrs} :aria-expanded="${stateKey}.toString()"`;
      }
    }
    if (needsBars) {
      const blob = `${h}\n${attrs}`;
      const lightNav =
        /\bbg-white\b/i.test(blob) ||
        /\bbg-stone-50\b/i.test(blob) ||
        /\bbg-zinc-50\b/i.test(blob) ||
        /\bbg-stone-100\b/i.test(blob);
      if (lightNav) {
        nextAttrs = nextAttrs.replace(/\btext-white\b/g, "text-neutral-900");
        if (!/\btext-(?:neutral|stone|zinc|slate|gray)-(?:[6-9]00|950)\b/.test(nextAttrs) && !/\btext-black\b/.test(nextAttrs)) {
          nextAttrs = `${nextAttrs} text-neutral-900`.replace(/\s+/g, " ");
        }
      } else if (!/\btext-(?:stone|zinc|neutral|slate|gray|white|black)\b/.test(nextAttrs)) {
        nextAttrs = `${nextAttrs} text-neutral-200`.replace(/\s+/g, " ");
      }
    }
    if (/\bclass\s*=\s*["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_m, q: string, c: string) => {
        if (/\bgentrix-menu-repaired\b/.test(c)) return `class=${q}${c}${q}`;
        return `class=${q}${c} gentrix-menu-repaired${q}`;
      });
    } else {
      nextAttrs = `${nextAttrs} class="gentrix-menu-repaired"`;
    }

    const nextInner = needsBars ? buildGentrixHamburgerFallbackInner(h, attrs) : inner;
    return `<button${nextAttrs}>${nextInner}</button>`;
  });

  if (next === fullHeader) return html;
  return html.slice(0, hm.index) + next + html.slice(hm.index + fullHeader.length);
}

/**
 * Repareert veelvoorkomende "broken drawer"-output:
 * - hamburgerknop zonder @click
 * - right/left fixed h-full drawer zonder x-show
 * - backdrop zonder x-show
 *
 * Strategie:
 * 1) detecteer section met mobiele knop + side-drawer patroon;
 * 2) kies state key (bestaande key uit x-data of fallback `navOpen`);
 * 3) voeg ontbrekende Alpine wiring toe met idempotente checks.
 */
export function repairBrokenMobileDrawer(html: string): string {
  const drawerMatch = html.match(
    /class\s*=\s*["'](?=[^"']*\bfixed\b)(?=[^"']*\bright-0\b)(?=[^"']*\bh-full\b)[^"']*["']/i,
  );
  logRepairBrokenMobileDrawer("[repair] aangeroepen, html lengte:", html.length);
  logRepairBrokenMobileDrawer("[repair] drawer regex match:", drawerMatch?.[0] ?? null);

  const sectionRepaired = html.replace(/<section\b[\s\S]*?<\/section>/gi, (section) =>
    repairBrokenMobileDrawerInScope(section),
  );
  const out = repairBrokenMobileDrawerInScope(sectionRepaired);
  logRepairBrokenMobileDrawer("[repair] output gewijzigd:", out !== html);
  return out;
}

/**
 * Veel AI-markup: mobiele backdrop/sheet `fixed` + `inset-*` + `x-show="navOpen"` maar **zonder** `lg:hidden`.
 * Dan blijft het paneel op desktop zichtbaar (Alpine inline wint van incomplete responsive utilities).
 * Voegt alleen `lg:hidden` toe wanneer het patroon duidelijk menu/overlay is.
 */
export function ensureAlpineMobileOverlayHasLgHidden(html: string): string {
  return html.replace(/<(div|aside|nav)\b([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const showM = /\bx-show\s*=\s*["']([^"']*)["']/i.exec(attrs);
    const hasAlpineNavShow = !!showM && xShowExpressionUsesNavToggle(showM[1]);

    const clsDouble = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs);
    const clsSingle = /\bclass\s*=\s*'([^']*)'/i.exec(attrs);
    const quote: '"' | "'" = clsDouble ? '"' : clsSingle ? "'" : ("" as '"' | "'");
    const clsRaw = clsDouble?.[1] ?? clsSingle?.[1] ?? "";
    if (!clsRaw) return full;

    const cls = clsRaw;
    if (!/\bfixed\b/.test(cls)) return full;
    const isInsetOverlay = /\binset-0\b|\binset-x-0\b/.test(cls);
    const isSideDrawer =
      /\b(?:left-0|right-0)\b/.test(cls) &&
      (/\binset-y-0\b/.test(cls) ||
        (/\btop-0\b/.test(cls) && (/\bbottom-0\b/.test(cls) || /\bh-full\b/.test(cls))));
    if (!isInsetOverlay && !isSideDrawer) return full;
    if (/\blg:hidden\b/.test(cls)) return full;

    const blob = `${attrs} ${cls}`.toLowerCase();
    const menuish =
      /backdrop|bg-slate-9|bg-black\/|from-slate|to-slate|via-slate|ring-white|shadow-\[0_2|site-mobile|mobile-sheet|drawer|sheet|z-\[6|z-\[7|z-\[8|z-\[9|z-\[1\d|z-60|z-50|z-45|z-40/.test(blob) ||
      /\b(id|aria-controls)\s*=\s*["'][^"']*(mobile|menu|sheet|drawer|nav)/i.test(attrs);
    if (!menuish) return full;
    /**
     * Ook statische side-drawers (zonder x-show) komen voor uit model-output als "tweede nav kolom".
     * Die moeten nooit op desktop zichtbaar blijven naast de hoofdnav.
     */
    const staticSideDrawerLikelyMenu = !showM && isSideDrawer && menuish;
    if (!hasAlpineNavShow && !staticSideDrawerLikelyMenu) return full;

    const newCls = `${cls} lg:hidden`.replace(/\s+/g, " ").trim();
    const nextAttrs = attrs.replace(
      quote === '"' ? /\bclass\s*=\s*"[^"]*"/i : /\bclass\s*=\s*'[^']*'/i,
      quote === '"' ? `class="${newCls}"` : `class='${newCls}'`,
    );
    return `<${tag}${nextAttrs}>`;
  });
}

/**
 * Sommige AI-uitvoer zet de hamburger-toggles zonder responsive utility neer; dan blijft de knop op desktop
 * zichtbaar naast desktop-navigatie. Voor menu-knoppen met Alpine-click + menu-aria voegen we `lg:hidden` toe.
 */
export function ensureAlpineMobileToggleButtonHasLgHidden(html: string): string {
  return html.replace(/<button\b([^>]*)>/gi, (full, attrs: string) => {
    const clickM = /(?:@click|x-on:click)\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (!clickM || !xShowExpressionUsesNavToggle(clickM[1])) return full;
    const hasMenuAria =
      /\baria-controls\s*=\s*["'][^"']*(mobile|menu|sheet|drawer|nav)/i.test(attrs) ||
      /\baria-label\s*=\s*["'][^"']*(menu|hamburger|open|openen|sluit|close|navigatie|navigation)/i.test(attrs);
    if (!hasMenuAria) return full;

    const clsDouble = /\bclass\s*=\s*"([^"]*)"/i.exec(attrs);
    const clsSingle = /\bclass\s*=\s*'([^']*)'/i.exec(attrs);
    const quote: '"' | "'" = clsDouble ? '"' : clsSingle ? "'" : ("" as '"' | "'");
    const clsRaw = clsDouble?.[1] ?? clsSingle?.[1] ?? "";
    if (!clsRaw) return full;
    if (/\blg:hidden\b/.test(clsRaw)) return full;

    const newCls = `${clsRaw} lg:hidden`.replace(/\s+/g, " ").trim();
    const nextAttrs = attrs.replace(
      quote === '"' ? /\bclass\s*=\s*"[^"]*"/i : /\bclass\s*=\s*'[^']*'/i,
      quote === '"' ? `class="${newCls}"` : `class='${newCls}'`,
    );
    return `<button${nextAttrs}>`;
  });
}

/** Inline tags waar modellen vaak alleen “SCROLL” / “Scroll” in zetten (case-insensitive strip). */
const DECORATIVE_SCROLL_CUE_TAG =
  "span|p|div|a|button|strong|em|label|h1|h2|h3|h4|h5|h6|small|i|b|kbd|aside|blockquote|cite|abbr|figcaption|time";

/**
 * Verwijdert decoratieve “SCROLL”-cues onderaan hero’s (model-template; blijft zichtbaar i.c.m. video-loop).
 * Alleen nodes waar de tekstinhoud **uitsluitend** “scroll” is (elke hoofdlettervorm) — geen woorden in lopende zinnen.
 */
export function stripDecorativeScrollCueMarkup(html: string): string {
  if (!/scroll/i.test(html)) return html;
  let s = html;
  const tagOnly = new RegExp(
    `<(${DECORATIVE_SCROLL_CUE_TAG})\\b[^>]{0,800}?>[\\s\\u00A0\\u200B]*scroll[\\s\\u00A0\\u200B]*<\\/\\1>`,
    "gi",
  );
  let prev: string;
  do {
    prev = s;
    s = s.replace(tagOnly, "");
  } while (s !== prev);
  s = s.replace(
    />[\s\u00A0\u200B]*(?:<br\s*\/?>[\s\u00A0\u200B]*)*scroll[\s\u00A0\u200B]*(?:<br\s*\/?>[\s\u00A0\u200B]*)*</gi,
    "><",
  );
  /** `writing-vertical-rl` + alleen scroll-label in het element. */
  s = s.replace(
    /<div\b[^>]{0,960}?\bwriting-vertical[^>]{0,960}?>[\s\u00A0\u200B]*scroll[\s\u00A0\u200B]*<\/div>/gi,
    "",
  );
  return s;
}

function stripBalancedSameNameTag(
  html: string,
  openStart: number,
  openTagLength: number,
  tagName: string,
): string | null {
  const start = openStart;
  const afterOpen = start + openTagLength;
  const tag = tagName.toLowerCase();
  let depth = 1;
  let pos = afterOpen;
  while (pos < html.length && depth > 0) {
    const rest = html.slice(pos);
    const openRe = new RegExp(`<${tag}\\b`, "i");
    const closeRe = new RegExp(`</${tag}\\s*>`, "i");
    const om = openRe.exec(rest);
    const cm = closeRe.exec(rest);
    if (!cm) return null;
    const oi = om ? om.index : Number.POSITIVE_INFINITY;
    const ci = cm.index;
    if (om && oi < ci) {
      depth += 1;
      pos += oi + om[0].length;
    } else {
      depth -= 1;
      pos += ci + cm[0].length;
      if (depth === 0) {
        return html.slice(0, start) + html.slice(pos);
      }
    }
  }
  return null;
}

/** Buitenste `studio-marquee`-wrapper (niet `studio-marquee-track`). */
const STUDIO_MARQUEE_OUTER_OPEN_RE =
  /<(div|section)\b[^>]*\bclass\s*=\s*"(?:studio-marquee(?!-track\b)|[^"]*\sstudio-marquee(?!-track\b))[^"]*"[^>]*>/i;

const STUDIO_MARQUEE_TRACK_OPEN_RE =
  /<(div|section)\b[^>]*\bclass\s*=\s*"[^"]*\bstudio-marquee-track\b[^"]*"[^>]*>/i;

/**
 * Verwijdert ticker/marquee-markup uit sectie-HTML (model output + legacy).
 * CSS (`STUDIO_MARQUEE_CSS`) blijft voor oude exports; nieuwe generaties mogen dit niet meer gebruiken.
 */
export function stripStudioMarqueeMarkupFromHtml(html: string): string {
  if (!html) return html;
  let s = html.replace(/<\s*marquee\b[^>]*>[\s\S]*?<\/\s*marquee\s*>/gi, "");
  if (!/\bstudio-marquee\b|\bstudio-marquee-track\b/i.test(s)) return s;

  let guard = 0;
  while (guard++ < 80) {
    const m = STUDIO_MARQUEE_OUTER_OPEN_RE.exec(s);
    if (!m) break;
    const next = stripBalancedSameNameTag(s, m.index, m[0].length, m[1]);
    if (next == null) break;
    s = next;
  }

  guard = 0;
  while (guard++ < 80) {
    const m = STUDIO_MARQUEE_TRACK_OPEN_RE.exec(s);
    if (!m) break;
    const next = stripBalancedSameNameTag(s, m.index, m[0].length, m[1]);
    if (next == null) break;
    s = next;
  }

  return s;
}

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

/** Alle `id="…"` in markup — nav mag naar nested ankers wijzen, niet alleen naar JSON-sectie-id's. */
export function collectHtmlElementIds(html: string): Set<string> {
  const out = new Set<string>();
  const re = /\bid\s*=\s*(["'])([^"']*)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const v = m[2]?.trim();
    if (v) out.add(v);
  }
  return out;
}

const RESERVED_SINGLE_SEGMENT_PATHS = new Set(
  ["portal", "boek", "winkel", "admin", "api", "login", "home", "dashboard", "site", "_next"].map((s) =>
    s.toLowerCase(),
  ),
);

/**
 * Multi-page marketing (`marketingPages` + contact-subroute): onbekende fragmenten en verzonnen
 * `/site/…/…`-subpaden wijzen naar echte studio-routes i.p.v. willekeurige `#hero`-fallbacks.
 */
export type MarketingCrossPageLinkContext = {
  marketingPageKeys: Set<string>;
  /** Contact staat op `/site/{slug}/contact`, niet als sectie op de huidige HTML-pagina. */
  contactOnDedicatedSubpage: boolean;
};

/**
 * NL/EN nav-labels → standaard `marketingPages`-keys (retail vs. service defaults).
 * Alleen van toepassing als de doel-key in `marketingPageKeys` van **deze** run zit.
 */
const MARKETING_PAGE_SLUG_SYNONYMS: Record<string, readonly string[]> = {
  assortiment: ["collectie"],
  catalogus: ["collectie"],
  aanbod: ["collectie"],
  shop: ["collectie"],
  producten: ["collectie"],
  diensten: ["wat-wij-doen"],
  services: ["wat-wij-doen"],
  methode: ["werkwijze"],
  procedure: ["werkwijze"],
  about: ["over-ons"],
  overons: ["over-ons"],
  veelgestelde: ["faq"],
  veelgesteldevragen: ["faq"],
  help: ["faq"],
  retour: ["service-retour"],
  garantie: ["service-retour"],
};

function matchCanonicalMarketingPageKey(fragment: string, keys: Set<string>): string | null {
  const f = fragment.trim();
  if (!f) return null;
  if (keys.has(f)) return f;
  const fk = slugifyIdSegment(f);
  for (const k of keys) {
    if (slugifyIdSegment(k) === fk) return k;
  }
  const synonymTargets = MARKETING_PAGE_SLUG_SYNONYMS[fk] ?? MARKETING_PAGE_SLUG_SYNONYMS[f.trim().toLowerCase()] ?? [];
  for (const t of synonymTargets) {
    if (keys.has(t)) return t;
    const tk = slugifyIdSegment(t);
    for (const k of keys) {
      if (slugifyIdSegment(k) === tk) return k;
    }
  }
  return null;
}

function contactFragmentRefersToDedicatedSubpage(
  fragment: string,
  validIds: Set<string>,
  cross: MarketingCrossPageLinkContext | undefined,
): boolean {
  if (!cross?.contactOnDedicatedSubpage || validIds.has("contact")) return false;
  const t = fragment.trim().toLowerCase();
  if (t === "contact" || t === "contact-us" || t === "contact_us") return true;
  return slugifyIdSegment(fragment) === "contact";
}

/** `href` voor echte marketing-subroute of contactpagina; `null` = geen cross-match. */
function crossPageHrefFromUnknownFragment(
  fragment: string,
  validIds: Set<string>,
  cross: MarketingCrossPageLinkContext | undefined,
): string | null {
  if (!cross) return null;
  if (cross.marketingPageKeys.size > 0) {
    const mk = matchCanonicalMarketingPageKey(fragment, cross.marketingPageKeys);
    if (mk) return `${STUDIO_SITE_BASE_PLACEHOLDER}/${mk}`;
  }
  if (contactFragmentRefersToDedicatedSubpage(fragment, validIds, cross)) {
    return STUDIO_CONTACT_PATH_PLACEHOLDER;
  }
  return null;
}

function crossPageHrefFromSinglePathSegment(
  segment: string,
  validIds: Set<string>,
  cross: MarketingCrossPageLinkContext | undefined,
): string | null {
  if (!cross) return null;
  if (cross.marketingPageKeys.size > 0) {
    const mk = matchCanonicalMarketingPageKey(segment, cross.marketingPageKeys);
    if (mk) return `${STUDIO_SITE_BASE_PLACEHOLDER}/${mk}`;
  }
  if (contactFragmentRefersToDedicatedSubpage(segment, validIds, cross)) {
    return STUDIO_CONTACT_PATH_PLACEHOLDER;
  }
  return null;
}

/**
 * Modellen zetten vaak `href="/site/slug"` of `https://…/site/slug` (zonder `#`) op elk menu-item.
 * In de srcDoc-iframe scrollt dat telkens naar boven → alle links voelen identiek. Zet om naar `#…`.
 * Ook `/diensten` → `#diensten` als die id bestaat.
 */
export function repairSamePagePathHrefsInHtml(
  html: string,
  validIds: Set<string>,
  crossPage?: MarketingCrossPageLinkContext,
): string {
  return html.replace(/href\s*=\s*(["'])([^"']*)\1/gi, (full, quote: string, inner: string) => {
    const next = pathOrAbsoluteSiteHrefToHash(inner, validIds, crossPage);
    if (next == null) return full;
    return `href=${quote}${next}${quote}`;
  });
}

function pathOrAbsoluteSiteHrefToHash(
  raw: string,
  validIds: Set<string>,
  cross?: MarketingCrossPageLinkContext,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("#") || /^mailto:|^tel:|^javascript:/i.test(trimmed)) return null;
  if (trimmed.includes("__STUDIO_")) return null;

  let pathname = "";
  let hash = "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      pathname = u.pathname || "";
      hash = u.hash && u.hash.length > 1 ? safeDecodeFragment(u.hash.slice(1)) : "";
    } catch {
      return null;
    }
    if (!pathname.toLowerCase().startsWith("/site/")) return null;
  } else {
    const hashIdx = trimmed.indexOf("#");
    let pathPart = trimmed;
    if (hashIdx >= 0) {
      hash = safeDecodeFragment(trimmed.slice(hashIdx + 1));
      pathPart = trimmed.slice(0, hashIdx);
    }
    pathname = (pathPart.split("?")[0] ?? "").trim();
    if (!pathname.startsWith("/")) return null;
  }

  const pl = pathname.toLowerCase();
  if (
    pl.startsWith("/portal") ||
    pl.startsWith("/boek") ||
    pl.startsWith("/winkel") ||
    pl.startsWith("/admin") ||
    pl.startsWith("/api") ||
    pl.startsWith("/_next") ||
    pl === "/login" ||
    pl.startsWith("/login/") ||
    pl === "/home" ||
    pl === "/dashboard"
  ) {
    return null;
  }

  const fb = pickFallbackFragment(validIds);

  if (pl === "/site" || pl === "/site/") {
    if (hash) {
      if (hash === "top" || validIds.has(hash)) return `#${hash}`;
      const crossH = crossPageHrefFromUnknownFragment(hash, validIds, cross);
      if (crossH) return crossH;
      return `#${fb}`;
    }
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  if (pl.startsWith("/site/")) {
    const rest = pathname.slice("/site/".length).split("/").filter(Boolean);
    if (rest.length > 1) {
      if (cross?.marketingPageKeys.size) {
        const sub = safeDecodeFragment(rest[1]!);
        if (sub.toLowerCase() === "contact") return null;
        if (matchCanonicalMarketingPageKey(sub, cross.marketingPageKeys)) return null;
        return STUDIO_SITE_BASE_PLACEHOLDER;
      }
      return null;
    }
    if (hash) {
      if (hash === "top" || validIds.has(hash)) return `#${hash}`;
      const crossH = crossPageHrefFromUnknownFragment(hash, validIds, cross);
      if (crossH) return crossH;
      return `#${fb}`;
    }
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  if (pathname === "/" || pathname === "") {
    return validIds.has("top") ? `#top` : `#${fb}`;
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const seg = safeDecodeFragment(segments[0]!);
    if (RESERVED_SINGLE_SEGMENT_PATHS.has(seg.toLowerCase())) return null;
    if (seg === "top" || validIds.has(seg)) return `#${seg}`;
    const segKey = slugifyIdSegment(seg);
    for (const vid of validIds) {
      if (slugifyIdSegment(vid) === segKey) return `#${vid}`;
    }
    const crossSeg = crossPageHrefFromSinglePathSegment(seg, validIds, cross);
    if (crossSeg) return crossSeg;
    return null;
  }

  return null;
}

function safeDecodeFragment(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Vervangt `href="#onbekend"` door een geldige anker-id uit de pagina.
 * Bij multi-page marketing: fragment dat een echte subroute is → `__STUDIO_SITE_BASE__/…` of contact-token.
 */
export function repairInternalLinksInHtml(
  html: string,
  validIds: Set<string>,
  crossPage?: MarketingCrossPageLinkContext,
): string {
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
    const crossH = crossPageHrefFromUnknownFragment(frag, validIds, crossPage);
    if (crossH) {
      return `href=${quote}${crossH}${quote}`;
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
/**
 * Landings- + contactpagina los post-processen (unieke id’s, interne #ankers per pagina).
 */
export function postProcessClaudeTailwindMarketingSite(
  page: ClaudeTailwindMarketingSiteOutput,
): ClaudeTailwindMarketingSiteOutput {
  const marketingPagesRaw = page.marketingPages;
  const marketingKeys =
    marketingPagesRaw != null && Object.keys(marketingPagesRaw).length > 0
      ? new Set(Object.keys(marketingPagesRaw))
      : null;
  const crossPage: MarketingCrossPageLinkContext | undefined =
    marketingKeys != null && marketingKeys.size > 0
      ? { marketingPageKeys: marketingKeys, contactOnDedicatedSubpage: true }
      : undefined;

  const landing = postProcessClaudeTailwindPage({ config: page.config, sections: page.sections }, { crossPage });
  const contact = postProcessClaudeTailwindPage(
    { config: page.config, sections: page.contactSections },
    { crossPage },
  );
  const marketingPages =
    marketingPagesRaw != null && Object.keys(marketingPagesRaw).length > 0
      ? Object.fromEntries(
          Object.entries(marketingPagesRaw).map(([k, secs]) => [
            k,
            postProcessClaudeTailwindPage({ config: page.config, sections: secs }, { crossPage }).sections,
          ]),
        )
      : undefined;
  return {
    config: landing.config,
    sections: landing.sections,
    contactSections: contact.sections,
    ...(marketingPages != null ? { marketingPages } : {}),
  };
}

export type PostProcessClaudeTailwindPageOptions = {
  crossPage?: MarketingCrossPageLinkContext;
};

/**
 * Verwijdert secties die typisch door het model als **ticker/marquee** of **losse CTA-band** worden toegevoegd,
 * terwijl het studio-contract (strikte landing) die verbiedt — het model negeert dat soms nog.
 * Ook zonder strikte modus: deze rijen worden uit de definitieve HTML gehaald zodat preview + export consistent zijn.
 */
export function shouldStripGeneratorTickerOrIntermediateCtaSectionId(id: string): boolean {
  const s = id.trim().toLowerCase();
  if (/^(marquee-strip|logo-marquee|logo-ticker|ticker|ticker-strip|tickertape|cta-band)$/i.test(s)) return true;
  if ((s.includes("marquee") || s.includes("ticker")) && (s.includes("strip") || s.includes("band") || s.includes("tape")))
    return true;
  return false;
}

function filterGeneratorStudioProductSections(
  sections: ClaudeTailwindPageOutput["sections"],
): ClaudeTailwindPageOutput["sections"] {
  return sections.filter((row) => !shouldStripGeneratorTickerOrIntermediateCtaSectionId(row.id));
}

/** Maximaal zoveel klikbare `tel:` / `wa.me`-ankers per genormaliseerd nummer (rest → `<span>`, zelfde volgorde). */
const MAX_CLICKABLE_CONTACT_ANCHORS_PER_CANON = 2;

const TEL_OR_WA_ANCHOR_RE = /<a\b[^>]*\bhref\s*=\s*(["'])(tel:[^"']*|https?:\/\/wa\.me\/[^"']+)\1[^>]*>[\s\S]*?<\/a>/gi;

/**
 * Stabiele sleutel voor dedupe: `tel:` + alleen cijfers, of `wa:` + cijfers uit pad.
 * Andere href's blijven buiten scope.
 */
function canonicalTelOrWaMeHrefKey(hrefRaw: string): string | null {
  const raw = hrefRaw.trim();
  if (/^tel:/i.test(raw)) {
    const digits = raw.slice(raw.indexOf(":") + 1).replace(/\D/g, "");
    return digits.length >= 8 ? `tel:${digits}` : null;
  }
  const m = raw.match(/^https?:\/\/wa\.me\/(\d{6,})/i);
  return m ? `wa:${m[1]}` : null;
}

type TelWaAnchorHit = { sectionIndex: number; start: number; end: number; full: string; key: string };

function collectTelWaAnchorHitsInSection(html: string, sectionIndex: number): TelWaAnchorHit[] {
  const hits: TelWaAnchorHit[] = [];
  const re = new RegExp(TEL_OR_WA_ANCHOR_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[2];
    const key = canonicalTelOrWaMeHrefKey(href);
    if (!key) continue;
    hits.push({
      sectionIndex,
      start: m.index,
      end: m.index + m[0].length,
      full: m[0],
      key,
    });
  }
  return hits;
}

/** `<a …href=tel|wa…>` → `<span …>` (geen href/target/rel), zodat dubbele CTA's niet vijf keer klikbaar blijven. */
function demoteTelOrWaAnchorToSpan(fullAnchor: string): string {
  return fullAnchor
    .replace(/^<a\b/i, "<span")
    .replace(/\s+href\s*=\s*(["'])(?:tel:[^"']*|https?:\/\/wa\.me[^"']*)\1/gi, "")
    .replace(/\s+target\s*=\s*(["'])[^"']*\1/gi, "")
    .replace(/\s+rel\s*=\s*(["'])[^"']*\1/gi, "")
    .replace(/<\/a\s*>/gi, "</span>");
}

/**
 * Verwijdert overtollige **klikbare** herhalingen van hetzelfde `tel:`- of `wa.me`-nummer over secties heen.
 * Houdt de **eerste** en **laatste** link (documentvolgorde: sectie-array, daarna match-volgorde in HTML);
 * tussenliggende worden naar `<span>` gezet. Geen LLM nodig — deterministisch.
 */
export function dedupeExcessTelAndWhatsAppAnchorsAcrossSections(
  sections: ClaudeTailwindPageOutput["sections"],
): ClaudeTailwindPageOutput["sections"] {
  if (sections.length === 0) return sections;

  const orderedHits: TelWaAnchorHit[] = [];
  for (let i = 0; i < sections.length; i++) {
    orderedHits.push(...collectTelWaAnchorHitsInSection(sections[i].html, i));
  }
  if (orderedHits.length === 0) return sections;

  const byKey = new Map<string, TelWaAnchorHit[]>();
  for (const h of orderedHits) {
    const list = byKey.get(h.key);
    if (list) list.push(h);
    else byKey.set(h.key, [h]);
  }

  const demoteKeys = new Set<string>();
  for (const [key, list] of byKey) {
    if (list.length > MAX_CLICKABLE_CONTACT_ANCHORS_PER_CANON) demoteKeys.add(key);
  }
  if (demoteKeys.size === 0) return sections;

  const demoteHitIdentity = new Set<string>();
  for (const key of demoteKeys) {
    const list = byKey.get(key)!;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      if (i === 0 || i === n - 1) continue;
      const h = list[i];
      demoteHitIdentity.add(`${h.sectionIndex}:${h.start}:${h.end}`);
    }
  }

  const opsBySection = new Map<number, Array<{ start: number; end: number; replacement: string }>>();
  for (const h of orderedHits) {
    if (!demoteHitIdentity.has(`${h.sectionIndex}:${h.start}:${h.end}`)) continue;
    const op = { start: h.start, end: h.end, replacement: demoteTelOrWaAnchorToSpan(h.full) };
    const arr = opsBySection.get(h.sectionIndex);
    if (arr) arr.push(op);
    else opsBySection.set(h.sectionIndex, [op]);
  }

  return sections.map((row, sectionIndex) => {
    const ops = opsBySection.get(sectionIndex);
    if (!ops?.length) return row;
    let html = row.html;
    const sorted = [...ops].sort((a, b) => b.start - a.start);
    for (const op of sorted) {
      if (op.start < 0 || op.end > html.length || op.start > op.end) continue;
      html = html.slice(0, op.start) + op.replacement + html.slice(op.end);
    }
    return { ...row, html };
  });
}

export function postProcessClaudeTailwindPage(
  page: ClaudeTailwindPageOutput,
  options?: PostProcessClaudeTailwindPageOptions,
): ClaudeTailwindPageOutput {
  const cross = options?.crossPage;
  const withIds = ensureUniqueSectionIds(filterGeneratorStudioProductSections(page.sections));
  const combined = withIds.map((row) => withRootIdOnSectionHtml(row.html, row.id)).join("\n");

  const validIds = new Set(withIds.map((s) => s.id));
  validIds.add("top");
  for (const id of collectHtmlElementIds(combined)) {
    validIds.add(id);
  }

  const sectionsLinked = withIds.map((row) => {
    const html0 = withRootIdOnSectionHtml(row.html, row.id);
    const html0b = repairSamePagePathHrefsInHtml(html0, validIds, cross);
    const html1 = repairInternalLinksInHtml(html0b, validIds, cross);
    const html2 = mergeDuplicateClassOnChromeTags(html1);
    const html2b = fixAlpineNavToggleDefaultsInXData(html2);
    const html2c0 = repairBrokenMobileDrawer(html2b);
    const html2ba = ensureAlpineMobileToggleButtonHasLgHidden(html2c0);
    const html2bb = ensureAlpineMobileOverlayHasLgHidden(html2ba);
    const html2c = stripDecorativeScrollCueMarkup(html2bb);
    const html2d = stripStudioMarqueeMarkupFromHtml(html2c);
    const html3 = row.id === "hero" ? ensureHeroRootMinViewportClass(html2d) : html2d;
    return { ...row, html: html3 };
  });

  const sectionsDeduped = dedupeExcessTelAndWhatsAppAnchorsAcrossSections(sectionsLinked);

  return { ...page, sections: sectionsDeduped };
}

const STREAMING_PREVIEW_PLACEHOLDER_MASTER_CONFIG: MasterPromptPageConfig = {
  style: "studio_streaming_preview",
  font: "Inter, ui-sans-serif, system-ui, sans-serif",
  theme: {
    primary: "#0f766e",
    accent: "#b45309",
    secondary: "#64748b",
  },
};

/**
 * Streaming site-studio: pas dezelfde HTML-postprocess toe als op de afgeronde JSON, zodat preview tijdens
 * genereren geen “ruwe” modelfouten toont (Alpine menu standaard open, dubbele class op nav/header, enz.).
 */
export function postProcessTailwindSectionsForStreamingPreview(
  sections: readonly TailwindSection[],
  config: TailwindPageConfig | null,
): TailwindSection[] {
  if (sections.length === 0) return [];
  const masterConfig: MasterPromptPageConfig =
    config != null && !isLegacyTailwindPageConfig(config) ? config : STREAMING_PREVIEW_PLACEHOLDER_MASTER_CONFIG;
  const page: ClaudeTailwindPageOutput = {
    config: masterConfig,
    sections: sections.map((s, i) => ({
      id: s.id?.trim() ? s.id.trim() : slugifyToSectionId(s.sectionName, i),
      html: s.html,
      name: s.sectionName.trim() || undefined,
    })),
  };
  const out = postProcessClaudeTailwindPage(page);
  return out.sections.map((row, i) => ({
    id: row.id,
    sectionName: row.name?.trim() || sections[i]?.sectionName?.trim() || row.id,
    html: row.html,
  }));
}

/** Alleen voor upgrade-prompt JSON (kleinere payload). */
export function normalizeHtmlWhitespaceForUpgradePrompt(html: string): string {
  return html.replace(/[\t\n\r]+/g, " ").replace(/\s{2,}/g, " ").trim();
}

const DEFAULT_FALLBACK_PRIMARY = "#0f766e";
const DEFAULT_FALLBACK_ACCENT = "#b45309";

function sanitizeThemeHex(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(t) ? t : fallback;
}

function extractThemeHexesFromParsedRoot(o: Record<string, unknown>): { primary: string; accent: string } {
  const cfg = o.config;
  if (cfg === null || typeof cfg !== "object" || Array.isArray(cfg)) {
    return { primary: DEFAULT_FALLBACK_PRIMARY, accent: DEFAULT_FALLBACK_ACCENT };
  }
  const theme = (cfg as Record<string, unknown>).theme;
  if (theme === null || typeof theme !== "object" || Array.isArray(theme)) {
    return { primary: DEFAULT_FALLBACK_PRIMARY, accent: DEFAULT_FALLBACK_ACCENT };
  }
  const th = theme as Record<string, unknown>;
  return {
    primary: sanitizeThemeHex(th.primary, DEFAULT_FALLBACK_PRIMARY),
    accent: sanitizeThemeHex(th.accent, DEFAULT_FALLBACK_ACCENT),
  };
}

/**
 * Minimale contactpagina + nav (zelfde studio-tokens als het model) als `contactSections` ontbreekt of leeg is.
 * Formulier alleen hier — homepage en marketing-subpagina's blijven form-vrij.
 */
export function buildDefaultClaudeMarketingContactSectionRow(
  primary: string,
  accent: string,
  marketingSlugs: readonly string[],
): {
  id: string;
  name: string;
  html: string;
} {
  const links = marketingSlugs
    .map((slug) => {
      const s = slug.trim().toLowerCase();
      const label = marketingPageNavLabel(s);
      return `        <a href="__STUDIO_SITE_BASE__/${s}" class="hover:opacity-80">${label}</a>`;
    })
    .join("\n");
  return {
    id: "contact",
    name: "Contact",
    html: `<section id="contact" class="bg-stone-50">
  <header class="border-b border-stone-200 bg-white/90 backdrop-blur">
    <nav class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-sm font-medium text-stone-700">
      <a href="__STUDIO_SITE_BASE__" class="font-semibold" style="color:${primary}">Home</a>
      <div class="flex flex-wrap items-center gap-3 md:gap-4">
${links}
        <a href="__STUDIO_CONTACT_PATH__" class="rounded-md px-3 py-1.5 text-white shadow-sm hover:opacity-90" style="background:${accent}">Contact</a>
      </div>
    </nav>
  </header>
  <div class="mx-auto max-w-xl px-4 py-16 md:py-24">
    <h1 class="text-3xl font-semibold tracking-tight text-stone-900">Neem contact op</h1>
    <p class="mt-3 text-stone-600">Laat een bericht achter; we nemen zo snel mogelijk contact met u op.</p>
    <form class="mt-10 space-y-5" method="post">
      <div>
        <label for="gentrix-contact-name" class="block text-sm font-medium text-stone-700">Naam</label>
        <input id="gentrix-contact-name" name="name" type="text" required autocomplete="name" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400" />
      </div>
      <div>
        <label for="gentrix-contact-email" class="block text-sm font-medium text-stone-700">E-mail</label>
        <input id="gentrix-contact-email" name="email" type="email" required autocomplete="email" class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400" />
      </div>
      <div>
        <label for="gentrix-contact-message" class="block text-sm font-medium text-stone-700">Bericht</label>
        <textarea id="gentrix-contact-message" name="message" rows="5" required class="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"></textarea>
      </div>
      <button type="submit" class="inline-flex w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold text-white shadow hover:opacity-90 md:w-auto" style="background:${primary}">Versturen</button>
    </form>
  </div>
</section>`,
  };
}

function isPlainJsonObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Modellen nesten soms per ongeluk sectie-arrays (bv. FAQ-items als `[[{…}], …]`).
 * Maakt één vlakke lijst van rijen; diepe nesting wordt recursief uitgeklapt.
 */
function flattenClaudeSectionRowArray(input: unknown): unknown[] {
  if (!Array.isArray(input)) return [];
  const out: unknown[] = [];
  for (const item of input) {
    if (Array.isArray(item)) {
      out.push(...flattenClaudeSectionRowArray(item));
    } else {
      out.push(item);
    }
  }
  return out;
}

function filterRowsWithIdAndHtml(rows: unknown[]): unknown[] {
  return rows.filter((row) => {
    if (!isPlainJsonObject(row)) return false;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const html = typeof row.html === "string" ? row.html.trim() : "";
    return id.length > 0 && html.length > 0;
  });
}

/**
 * Normaliseert `sections`, `contactSections` en elke `marketingPages[*]` vóór Zod-parse:
 * geneste arrays worden platgeslagen; rijen zonder `id`+`html` vallen weg.
 */
export function normalizeClaudeSectionArraysInParsedJson(parsed: unknown): unknown {
  if (!isPlainJsonObject(parsed)) {
    return parsed;
  }
  const o = { ...parsed };

  if (Array.isArray(o.sections)) {
    o.sections = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(o.sections));
  }
  if (Array.isArray(o.contactSections)) {
    o.contactSections = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(o.contactSections));
  }
  if (o.marketingPages != null && isPlainJsonObject(o.marketingPages)) {
    const mp = o.marketingPages as Record<string, unknown>;
    const next: Record<string, unknown> = { ...mp };
    for (const [k, v] of Object.entries(mp)) {
      if (Array.isArray(v)) {
        next[k] = filterRowsWithIdAndHtml(flattenClaudeSectionRowArray(v));
      }
    }
    o.marketingPages = next;
  }
  return o;
}

function marketingContactSectionsArrayLooksValid(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false;
  return raw.every((row) => {
    if (row === null || typeof row !== "object" || Array.isArray(row)) return false;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const html = typeof r.html === "string" ? r.html.trim() : "";
    return id.length > 0 && html.length > 0;
  });
}

function marketingContactSectionsIncludeForm(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  const joined = raw
    .map((row) => {
      if (row === null || typeof row !== "object" || Array.isArray(row)) return "";
      const h = (row as Record<string, unknown>).html;
      return typeof h === "string" ? h : "";
    })
    .join("\n");
  return /<form\b/i.test(joined);
}

/**
 * Vult ontbrekende `contactSections` aan vóór Zod-parse (marketing multi-page).
 * Voorkomt schema-fouten wanneer het model het veld weglaat; het formulier blijft op de contact-subroute.
 */
export function ensureClaudeMarketingSiteJsonHasContactSections(
  parsed: unknown,
  marketingSlugsForDefaultNav?: readonly string[] | null,
): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }
  const o = parsed as Record<string, unknown>;
  if (
    marketingContactSectionsArrayLooksValid(o.contactSections) &&
    marketingContactSectionsIncludeForm(o.contactSections)
  ) {
    return parsed;
  }
  const { primary, accent } = extractThemeHexesFromParsedRoot(o);
  let slugs: string[] =
    marketingSlugsForDefaultNav?.length && marketingSlugsForDefaultNav.length > 0
      ? [...marketingSlugsForDefaultNav]
      : typeof o.marketingPages === "object" &&
          o.marketingPages !== null &&
          !Array.isArray(o.marketingPages)
        ? Object.keys(o.marketingPages as Record<string, unknown>)
        : [];
  if (slugs.length === 0) {
    slugs = [...DEFAULT_SERVICE_MARKETING_SLUGS];
  }
  const row = buildDefaultClaudeMarketingContactSectionRow(primary, accent, slugs);
  return { ...o, contactSections: [row] };
}

// ---------------------------------------------------------------------------
// Studio: vaste image-vrije output (geen stock-API, geen <img> / video / iframe)
// ---------------------------------------------------------------------------

function stripRasterMediaElementsFromHtml(html: string): string {
  let out = html;
  out = out.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, "");
  out = out.replace(/<video\b[^>]*>[\s\S]*?<\/video>/gi, "");
  out = out.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  out = replaceAllOpenTagsByLocalName(out, "img", () => "");
  out = replaceAllOpenTagsByLocalName(out, "source", () => "");
  return out;
}

function studioImageFreeSingleHtml(html: string): string {
  let s = stripRasterMediaElementsFromHtml(html);
  s = stripAllUnsplashPhotoUrlsInHtml(s);
  s = cleanupStrippedStockMarkup(s);
  return s;
}

function mapSectionsImageFree(sections: TailwindSection[]): TailwindSection[] {
  return sections.map((s) => ({ ...s, html: studioImageFreeSingleHtml(s.html) }));
}

/** Na generatie: verwijdert alle raster-/embed-media en resterende `images.unsplash.com`-URL's (deterministisch). */
export function applyStudioImageFreeHtmlPass(page: GeneratedTailwindPage): GeneratedTailwindPage {
  return {
    ...page,
    sections: mapSectionsImageFree(page.sections),
    ...(page.contactSections?.length
      ? { contactSections: mapSectionsImageFree(page.contactSections) }
      : {}),
    ...(page.marketingPages && Object.keys(page.marketingPages).length > 0
      ? {
          marketingPages: Object.fromEntries(
            Object.entries(page.marketingPages).map(([k, v]) => [k, mapSectionsImageFree(v)]),
          ),
        }
      : {}),
  };
}
