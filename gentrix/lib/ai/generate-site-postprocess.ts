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
  stripHallucinatedStockPhotoUrlsInHtml,
} from "@/lib/ai/strip-hallucinated-stock-photo-urls";
import { findHtmlOpenTagEnd, replaceAllOpenTagsByLocalName, sliceOpenTagContent } from "@/lib/site/html-open-tag";
import { walkBalancedSameLocalBlock } from "@/lib/site/html-balanced-element";
import { addDefaultLazyLoadingToBelowFoldSectionImages } from "@/lib/site/html-img-lazy-default";
import {
  addResponsiveSrcsetToHeroSupabaseRenderImages,
  promoteHeroSupabaseBackgroundUrlToImg,
  rewriteSupabaseStorageObjectUrlsForWebDelivery,
} from "@/lib/site/supabase-storage-delivery-url";

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
  if (/\b(?:sm|md|lg|xl|2xl):hidden\b/i.test(attrs) || /\bmax-(?:sm|md|lg|xl|2xl):hidden\b/i.test(attrs)) {
    score += 6;
  }
  if (/\baria-label\s*=\s*["'][^"']*(?:menu|enu|hamburger|burger|open|openen|sluit|close|navigat)/i.test(attrs)) {
    score += 6;
  }
  if (/\baria-controls\s*=\s*["'][^"']*(?:mobile|menu|drawer|sheet|nav)/i.test(attrs)) score += 6;
  if (/\bclass\s*=\s*["'][^"']*(?:menu|hamburger|burger|nav-toggle|drawer-toggle|mobile-toggle)[^"']*["']/i.test(attrs)) {
    score += 5;
  }
  /** Vaak al `@click` vóór reparatie; zonder lg:hidden/aria was de score te laag. */
  if (
    /(?:@click|x-on:click)\s*=\s*["'][^"']*\b(?:navOpen|menuOpen|mobileOpen|drawerOpen|sheetOpen)\s*=\s*!\s*(?:navOpen|menuOpen|mobileOpen|drawerOpen|sheetOpen)\b/i.test(
      attrs,
    )
  ) {
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

/**
 * `x-data` injecteren op de eerste passende top-tag. Moet **quote-aware** zijn: `>` in
 * `@scroll.window="... scrollY > 10"` valt anders vóór de slot-`>` van de open-tag, waardoor
 * fragmenten als `10" :class="…">` als tekst in de DOM belanden.
 */
function injectNavStateScope(html: string, stateKey: string): string {
  const scopeAttrs = ` x-data="{ ${stateKey}: false }" @keydown.escape.window="${stateKey} = false"`;
  const hi = html.search(/<header\b/i);
  if (hi !== -1) {
    const hs = sliceOpenTagContent(html, hi);
    if (hs && /\bx-data\s*=/i.test(hs.attrs)) {
      /** Header heeft al Alpine-scope — niet op de eerste `<div>` daarbinnen injecteren (dubbele `@keydown`). */
      return html;
    }
  }
  const tryInject = (re: RegExp): string | null => {
    const m = re.exec(html);
    if (m == null) return null;
    const s = sliceOpenTagContent(html, m.index);
    if (!s || /\bx-data\s*=/i.test(s.attrs)) return null;
    return `${html.slice(0, m.index)}<${s.tagName}${s.attrs}${scopeAttrs}>${html.slice(s.end)}`;
  };
  return (
    tryInject(/<header\b/i) ?? tryInject(/<section\b/i) ?? tryInject(/<(div|nav|aside|main|article)\b/i) ?? html
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

/**
 * Premium hamburger↔X-toggle in dezelfde knop, als inline SVG.
 *
 * Waarom SVG in plaats van utility-bars?
 * - `rotate-45` vereist een parent die centreert op één punt; AI-output heeft vaak een `flex flex-col`
 *   knop waardoor twee gedraaide spans *naast* elkaar belanden en je geen X krijgt maar "| |".
 * - SVG is visueel identiek ongeacht de klassen op de button-parent — werkt ook in `flex flex-col gap-x`.
 * - `stroke="currentColor"` erft de tekstkleur van de knop (die we elders al licht/donker normaliseren).
 * - **Geen `x-show` op de twee SVG's:** vóór Alpine-init zijn beide anders zichtbaar (X door strepen).
 *   We gebruiken `gentrix-menu-toggle-css` + `:class="gentrix-menu-open"` + `GENTRIX_MENU_ICON_TOGGLE_CSS`
 *   (zie `tailwind-page-html.ts`) voor een dichte default zonder FOUC.
 * - `pointer-events-none` stuurt de klik altijd door naar de button.
 */
export function buildGentrixMenuIconToggle(stateKey: string): string {
  const svgBase =
    `class="absolute inset-0 h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  const hamburger =
    `<svg ${svgBase} aria-hidden="true">` +
    `<line x1="4" y1="7" x2="20" y2="7"/>` +
    `<line x1="4" y1="12" x2="20" y2="12"/>` +
    `<line x1="4" y1="17" x2="20" y2="17"/>` +
    `</svg>`;
  const cross =
    `<svg ${svgBase} aria-hidden="true">` +
    `<line x1="6" y1="6" x2="18" y2="18"/>` +
    `<line x1="18" y1="6" x2="6" y2="18"/>` +
    `</svg>`;
  return `<span class="gentrix-menu-icon gentrix-menu-toggle-css pointer-events-none relative inline-flex h-6 w-6 items-center justify-center" :class="{ 'gentrix-menu-open': ${stateKey} }" aria-hidden="true">${hamburger}${cross}</span>`;
}

/**
 * Detecteert of de bestaande knop-inhoud al onze premium dual-state toggle bevat.
 * Alleen `gentrix-menu-icon` is onvoldoende: sommige sites houden de wrapper maar lege
 * of kapotte SVG's — dan moeten we opnieuw `buildGentrixMenuIconToggle` injecteren.
 */
function innerHasHamburgerXToggle(inner: string, stateKey: string): boolean {
  if (!/\bgentrix-menu-icon\b/.test(inner)) return false;
  if (/\bgentrix-menu-toggle-css\b/.test(inner)) return true;
  const k = escapeRegExpKey(stateKey);
  const closed = new RegExp(`x-show\\s*=\\s*["']\\s*!\\s*${k}\\b`, "i");
  const openOnly = new RegExp(`x-show\\s*=\\s*["']\\s*${k}\\s*["']`, "i");
  return closed.test(inner) && openOnly.test(inner);
}

/** Oudere exports + Edge: `x-cloak` / `x-transition` op de toggles kan het kruis permanent verbergen. */
function stripAlpineVisualBlockersFromGentrixMenuIconInner(html: string): string {
  if (!/\bgentrix-menu-icon\b/.test(html)) return html;
  return html
    .replace(/\s+x-cloak\b/gi, "")
    .replace(/\s*x-transition(?::[a-z-]+)?="[^"]*"/gi, "")
    .replace(/\s*x-transition(?::[a-z-]+)?='[^']*'/gi, "");
}

/**
 * Modellen zetten soms `md:hidden` op de menuknop. Dat verbergt vanaf 768px — dan zie je geen hamburger
 * en geen kruis op tablet. Oplossing: (1) `md:hidden` + `lg:hidden` → `lg:hidden` alleen;
 * (2) alleen `md:hidden` → `lg:hidden` (zelfde bedoeling als “mobiel tot lg-breakpoint”).
 */
function normalizeMobileMenuButtonHiddenClassesInAttrs(attrs: string): string {
  /** Declaratieve `studioNav`-chrome: bewust `md:hidden` (tablet = desktop-nav); niet naar `lg` omzetten. */
  if (/\bstudio-nav-chrome-menu-btn\b/.test(attrs)) return attrs;
  return attrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/gi, (full, q: string, c: string) => {
    if (!/\bmd:hidden\b/.test(c)) return full;
    let next = c;
    if (/\blg:hidden\b/.test(c)) {
      next = c.replace(/\bmd:hidden\b/g, "");
    } else {
      next = c.replace(/\bmd:hidden\b/g, "lg:hidden");
    }
    next = next.replace(/\s+/g, " ").trim();
    return `class=${q}${next}${q}`;
  });
}

function isLikelyHeaderMobileMenuButton(attrs: string): boolean {
  if (menuButtonHintScore(attrs) >= 6) return true;
  const hasBreakpointHide =
    /\b(?:lg|md|sm|xl|2xl):hidden\b/i.test(attrs) || /\bmax-(?:sm|md|lg|xl|2xl):hidden\b/i.test(attrs);
  const layoutish =
    /\b(?:inline-)?flex\b/i.test(attrs) ||
    /\bgrid\b/i.test(attrs) ||
    /\bitems-center\b/i.test(attrs) ||
    /\bjustify-(?:center|between|end)\b/i.test(attrs);
  /** Veel AI-menuknoppen: `flex items-center justify-center` zonder `gap-*` — oude `spaced`-plicht sloeg mis. */
  const spaced =
    /\bgap-/.test(attrs) ||
    /\bspace-[xy]-/.test(attrs) ||
    /\bplace-(?:content|items)-/.test(attrs) ||
    (/\bitems-center\b/.test(attrs) && /\bjustify-(?:center|between|end)\b/.test(attrs));
  return (
    hasBreakpointHide &&
    /\baria-label\s*=\s*["'][^"']*(?:menu|Menu|enu|hamburger)/i.test(attrs) &&
    layoutish &&
    spaced
  );
}

/**
 * Berekent of een header-achtergrond "donker" is, zodat we de menuknop-icon de juiste tekstkleur
 * (en dus SVG-stroke) kunnen geven. Werkt voor zowel Tailwind-palette klassen als arbitrary hexes.
 *
 * Donker ⇒ `text-neutral-100` (witte streepjes)
 * Anders ⇒ `text-neutral-900` (zwarte streepjes) — ook voor crème/pastel/beige headers.
 */
function findFirstBannerDivOpenIndex(html: string): number | null {
  let scan = 0;
  while (scan < html.length) {
    const rel = html.slice(scan);
    const dm = /<div\b/gi.exec(rel);
    if (!dm) return null;
    const abs = scan + dm.index;
    const s = sliceOpenTagContent(html, abs);
    if (!s) {
      scan = abs + 4;
      continue;
    }
    if (/\brole\s*=\s*["']banner["']/i.test(s.attrs)) return abs;
    scan = s.end;
  }
  return null;
}

function findFirstStickyNavChromeOpenIndex(html: string): number | null {
  let scan = 0;
  while (scan < html.length) {
    const rel = html.slice(scan);
    const nm = /<nav\b/gi.exec(rel);
    if (!nm) return null;
    const abs = scan + nm.index;
    const s = sliceOpenTagContent(html, abs);
    if (!s) {
      scan = abs + 4;
      continue;
    }
    const cls = s.attrs.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1]?.replace(/\s+/g, " ") ?? "";
    const hasSticky = /\bsticky\b/i.test(cls) || /\bfixed\b/i.test(cls);
    const hasTop0 = /\btop-0\b/i.test(cls);
    if (hasSticky && hasTop0) return abs;
    scan = s.end;
  }
  return null;
}

/** Eerste `<header>`, `div[role=banner]`, of wortel-`<nav>` opening tag (quote-aware). */
function sliceFirstSiteChromeOpenTagFull(h: string): string {
  const hi = h.search(/<header\b/i);
  if (hi !== -1) {
    const s = sliceOpenTagContent(h, hi);
    if (s) return s.full;
  }
  let scan = 0;
  while (scan < h.length) {
    const dm = /<div\b/gi.exec(h.slice(scan));
    if (!dm) break;
    const abs = scan + dm.index;
    const s = sliceOpenTagContent(h, abs);
    if (!s) {
      scan = abs + 4;
      continue;
    }
    if (/\brole\s*=\s*["']banner["']/i.test(s.attrs)) return s.full;
    scan = s.end;
  }
  if (/^\s*<nav\b/i.test(h)) {
    const ni = h.search(/<nav\b/i);
    if (ni !== -1) {
      const s = sliceOpenTagContent(h, ni);
      if (s) return s.full;
    }
  }
  return "";
}

function replaceAllOpenTagsQuoteAware(
  html: string,
  replacer: (tagName: string, attrs: string, full: string) => string,
): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const m = /^<([a-zA-Z][\w:-]*)\b/.exec(html.slice(lt));
    if (!m) {
      out += "<";
      i = lt + 1;
      continue;
    }
    const tagStart = lt;
    const end = findHtmlOpenTagEnd(html, tagStart);
    const full = html.slice(tagStart, end);
    const tagName = m[1]!;
    const attrs = full.slice(m[0].length, full.length - 1);
    out += replacer(tagName, attrs, full);
    i = end;
  }
  return out;
}

function isHeaderBackgroundDark(blob: string): boolean {
  // 1) Palette-kleuren: `bg-black`, `bg-(neutral|zinc|slate|stone|gray)-(700|800|900|950)`.
  if (/\bbg-black\b/i.test(blob)) return true;
  if (/\bbg-(?:neutral|zinc|slate|stone|gray)-(?:700|800|900|950)\b/i.test(blob)) return true;

  // 2) Arbitrary hex: `bg-[#rgb]` of `bg-[#rrggbb]` — kies de eerste match in het blob (meestal de header zelf).
  const hexMatch = /\bbg-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]/.exec(blob);
  if (hexMatch) {
    const hex = hexMatch[1];
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    // Standaard perceptual luminance (ITU-R BT.601): onder 128 ⇒ donker.
    const luminance = r * 0.299 + g * 0.587 + b * 0.114;
    return luminance < 128;
  }
  return false;
}

/**
 * Eerste top-chrome: `<header>…</header>`, `<div role="banner">…</div>`, of **primaire**
 * `<nav class="sticky|fixed … top-0 …">…</nav>` (modellen slaan soms `<header>` over).
 */
export function sliceFirstSiteChromeNavBlock(html: string): { block: string; start: number; end: number } | null {
  const headerOpen = /<header\b/i.exec(html);
  if (headerOpen?.index !== undefined) {
    const w = walkBalancedSameLocalBlock(html, headerOpen.index, "header");
    if (w) return w;
  }

  const bannerIdx = findFirstBannerDivOpenIndex(html);
  if (bannerIdx !== null) {
    const w = walkBalancedSameLocalBlock(html, bannerIdx, "div");
    if (w) return w;
  }

  /** Eerste sticky/fixed top-balk als `<nav>` — anders geen `repairHeaderMobileMenuButton` / drawer-fix. */
  const navIdx = findFirstStickyNavChromeOpenIndex(html);
  if (navIdx !== null) {
    const w = walkBalancedSameLocalBlock(html, navIdx, "nav");
    if (w) return w;
  }

  return null;
}

function injectNavStateScopeOnChromeBlock(h: string, stateKey: string): string {
  const scopeAttrs = ` x-data="{ ${stateKey}: false }" @keydown.escape.window="${stateKey} = false"`;
  const hi = h.search(/<header\b/i);
  if (hi !== -1) {
    const s = sliceOpenTagContent(h, hi);
    if (s && !/\bx-data\s*=/i.test(s.attrs)) {
      return `${h.slice(0, hi)}<${s.tagName}${s.attrs}${scopeAttrs}>${h.slice(s.end)}`;
    }
  }
  let scan = 0;
  while (scan < h.length) {
    const rel = h.slice(scan);
    const dm = /<div\b/gi.exec(rel);
    if (!dm) break;
    const abs = scan + dm.index;
    const s = sliceOpenTagContent(h, abs);
    if (!s) {
      scan = abs + 4;
      continue;
    }
    if (/\brole\s*=\s*["']banner["']/i.test(s.attrs) && !/\bx-data\s*=/i.test(s.attrs)) {
      return `${h.slice(0, abs)}<${s.tagName}${s.attrs}${scopeAttrs}>${h.slice(s.end)}`;
    }
    scan = s.end;
  }
  /** Alleen de **wortel**-nav (slice = hele `<nav>…</nav>`); niet de eerste `<nav>` ínside een `<header>`. */
  if (/^\s*<nav\b/i.test(h)) {
    const ni = h.search(/<nav\b/i);
    if (ni !== -1) {
      const s = sliceOpenTagContent(h, ni);
      if (s && !/\bx-data\s*=/i.test(s.attrs)) {
        return `${h.slice(0, ni)}<${s.tagName}${s.attrs}${scopeAttrs}>${h.slice(s.end)}`;
      }
    }
  }
  return injectNavStateScope(h, stateKey);
}

/**
 * Veel AI-markup: desktop-links `hidden md:flex` maar menuknop `lg:hidden` + sheet `md:hidden`.
 * Tussen **768–1023px** is de knop dan wél zichtbaar (tot lg), maar het paneel blijft verborgen
 * (`md:hidden` vanaf 768) — “hamburger doet niets” / lijkt verdwenen naast de desktoprij.
 * Los door desktop naar `lg` te tillen en `md:hidden` op `x-show`-menu-panelen naar `lg:hidden`.
 */
export function alignChromeNavMdLgBreakpoints(html: string): string {
  const sliced = sliceFirstSiteChromeNavBlock(html);
  if (!sliced) return html;

  const block = sliced.block;
  const desktopMd =
    /\bhidden\s+md:flex\b/i.test(block) || /\bhidden\s+md:inline-flex\b/i.test(block);
  const menuLgHidden =
    /\blg:hidden\b/i.test(block) &&
    /(?:gentrix-menu-repaired|gentrix-menu-icon|@click\s*=\s*["'][^"']*\b(?:open|navOpen|menuOpen|mobileOpen|drawerOpen|sheetOpen)\s*=\s*!)/i.test(
      block,
    );
  if (!desktopMd || !menuLgHidden) return html;

  let next = block
    .replace(/\bhidden\s+md:flex\b/gi, "hidden lg:flex")
    .replace(/\bhidden\s+md:inline-flex\b/gi, "hidden lg:inline-flex");

  next = replaceAllOpenTagsQuoteAware(next, (tagName, attrs, full) => {
    if (!/\bx-show\s*=/i.test(attrs)) return full;
    if (!/\bclass\s*=\s*["']/i.test(attrs) && !/\bclass\s*=\s*'/i.test(attrs)) return full;
    const showM = /\bx-show\s*=\s*["']([^"']*)["']/i.exec(attrs);
    if (!showM?.[1] || !xShowExpressionUsesNavToggle(showM[1])) return full;
    if (!/\bmd:hidden\b/i.test(attrs)) return full;
    const replaced = attrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/gi, (_m, q: string, c: string) => {
      if (!/\bmd:hidden\b/i.test(c)) return `class=${q}${c}${q}`;
      const nc = c.replace(/\bmd:hidden\b/gi, "lg:hidden");
      return `class=${q}${nc}${q}`;
    });
    if (replaced === attrs) return full;
    return `<${tagName}${replaced}>`;
  });

  if (next === block) return html;
  return html.slice(0, sliced.start) + next + html.slice(sliced.end);
}

/**
 * Normaliseert de mobiele menuknop in de eerste site-chrome (`<header>`, `div[role="banner"]`, of wortel-`<nav>`):
 *   - zorgt voor een `@click`-toggle op de juiste Alpine-state,
 *   - vervangt inhoud die géén echte hamburger↔× twee-staten-toggle is door de premium
 *     `gentrix-menu-icon` (drie streepjes ↔ kruisje, vloeiend overgaan).
 *
 * Voorheen werden alleen *lege* knoppen gevuld met statische streepjes. Het gevolg: AI-output die
 * een los icoon (bijv. `☰`, een enkel SVG zonder `x-show`) toont, bleef zichtbaar terwijl het menu
 * open stond — geen kruisje, geen feedback. De nieuwe detectie laat alleen knoppen die zelf al
 * een correcte twee-staten-toggle hebben met rust.
 */
export function repairHeaderMobileMenuButton(html: string): string {
  const sliced = sliceFirstSiteChromeNavBlock(html);
  if (!sliced) return html;

  const fullHeader = sliced.block;
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
    h = injectNavStateScopeOnChromeBlock(h, stateKey);
  }

  const next = h.replace(/<button(\b[^>]*)>([\s\S]*?)<\/button>/gi, (full, attrs: string, inner: string) => {
    if (!isLikelyHeaderMobileMenuButton(attrs)) return full;

    const withoutComments = inner.replace(/<!--[\s\S]*?-->/g, "");
    const innerCleaned = stripAlpineVisualBlockersFromGentrixMenuIconInner(withoutComments);
    const stripChangedInner = innerCleaned !== withoutComments;
    const trimmed = innerCleaned.trim();
    const hasProperToggle = innerHasHamburgerXToggle(trimmed, stateKey);

    const needsClick = !/(?:@click|x-on:click)\s*=/.test(attrs);
    const needsIcon = !hasProperToggle;
    if (!needsClick && !needsIcon) {
      const normalizedAttrs = normalizeMobileMenuButtonHiddenClassesInAttrs(attrs);
      if (normalizedAttrs === attrs && !stripChangedInner) return full;
      const body = stripChangedInner ? innerCleaned : inner;
      return `<button${normalizedAttrs}>${body}</button>`;
    }

    let nextAttrs = normalizeMobileMenuButtonHiddenClassesInAttrs(attrs);
    if (needsClick) {
      nextAttrs = `${nextAttrs} @click="${stateKey} = !${stateKey}"`;
      if (!/\baria-expanded\s*=/.test(nextAttrs)) {
        nextAttrs = `${nextAttrs} :aria-expanded="${stateKey}.toString()"`;
      }
    }

    // Verzamel extra classes die binnen `class="..."` moeten landen. Nooit als losse attributen plakken,
    // anders wordt `text-neutral-900` een bare attribute op de button i.p.v. een utility.
    const extraClasses: string[] = [];
    if (!/\bgentrix-menu-repaired\b/.test(nextAttrs)) {
      extraClasses.push("gentrix-menu-repaired");
    }
    if (needsIcon) {
      // Alleen de *chrome-root* (header, `div[role=banner]`, of wortel-`<nav>`) inspecteren voor achtergrondkleur —
      // niet de kinderen, anders detecteert een donkere drawer (`bg-stone-900`) de balk foutief als donker.
      const chromeOpenTag = sliceFirstSiteChromeOpenTagFull(h);
      const blob = `${chromeOpenTag}\n${nextAttrs}`;
      const darkNav = isHeaderBackgroundDark(blob);
      if (!darkNav) {
        // Lichte/neutrale header: een `text-white` op de button zou onzichtbaar zijn → forceer donker.
        nextAttrs = nextAttrs.replace(/\btext-white\b/g, "text-neutral-900");
      }
      const hasExplicitTextColor =
        /\btext-(?:neutral|stone|zinc|slate|gray)-(?:[1-9]00|950)\b/i.test(nextAttrs) ||
        /\btext-(?:black|white)\b/i.test(nextAttrs);
      if (!hasExplicitTextColor) {
        extraClasses.push(darkNav ? "text-neutral-100" : "text-neutral-900");
      }
    }

    if (extraClasses.length > 0) {
      if (/\bclass\s*=\s*["']/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_m, q: string, c: string) => {
          const additions = extraClasses.filter(
            (cls) => !new RegExp(`\\b${escapeRegExpKey(cls)}\\b`).test(c),
          );
          if (additions.length === 0) return `class=${q}${c}${q}`;
          const merged = `${c} ${additions.join(" ")}`.replace(/\s+/g, " ").trim();
          return `class=${q}${merged}${q}`;
        });
      } else {
        nextAttrs = `${nextAttrs} class="${extraClasses.join(" ")}"`;
      }
    }

    const nextInner = needsIcon ? buildGentrixMenuIconToggle(stateKey) : stripChangedInner ? innerCleaned : inner;
    return `<button${nextAttrs}>${nextInner}</button>`;
  });

  if (next === fullHeader) return html;
  // Als een button werd gerepareerd maar de header nog steeds geen x-data heeft, injecteer de scope.
  // Voorbeeld: sanitizer stripte zowel x-data als x-show — de @click werkt anders niet (Alpine-scope miss).
  const repaired = !/\bx-data\s*=/i.test(probe) ? injectNavStateScopeOnChromeBlock(next, stateKey) : next;
  return html.slice(0, sliced.start) + repaired + html.slice(sliced.end);
}

/**
 * Zet de mobiele drawer binnen de sticky <header> om naar een "push-down"-paneel à la Vugts Makelaardij:
 *  - Logo blijft altijd zichtbaar (de header is sticky).
 *  - Drawer is *in-flow* onder de top-bar, geen fixed overlay meer.
 *  - Open → header wordt hoger → hero eronder schuift vloeiend naar beneden.
 *  - Soepele slide-down via `x-transition` op `max-height` + `opacity` (werkt met Tailwind Play CDN).
 *
 * Alleen drawers die er nu als full-screen overlay uitzien (`fixed` + `inset-0` / `h-screen` /
 * `min-h-screen` / hoge z-index) worden omgezet. Drawers die al in-flow zijn of reeds de
 * `gentrix-push-drawer`-marker hebben laten we met rust (idempotent).
 *
 * Rationale: pure AI-output plaatst vrijwel altijd `<div x-show="navOpen" class="fixed inset-0 ...">`
 * als kind van de header. Dat dekt het hele scherm af → logo valt weg, hero wordt niet geduwd.
 */
export function convertMobileDrawerToPushDown(html: string): string {
  const sliced = sliceFirstSiteChromeNavBlock(html);
  if (!sliced) return html;
  const fullHeader = sliced.block;
  /** Renderer-levering: vast volle-breedte sheet + eigen transitie — niet naar push-drawer muteren. */
  if (/\bdata-studio-nav-chrome\s*=\s*["']1["']/i.test(fullHeader)) return html;

  const drawerOpenRe =
    /<(div|nav|aside)(\b[^>]*\bx-show\s*=\s*["'][^"']*\b(?:navOpen|menuOpen|mobileOpen|menuVisible|mobileMenuOpen|drawerOpen|sheetOpen)\b[^"']*["'][^>]*)>/gi;

  const next = fullHeader.replace(drawerOpenRe, (full, tag: string, attrs: string) => {
    const clsM = /\bclass\s*=\s*(["'])([^"']*)\1/i.exec(attrs);
    if (!clsM) return full;
    const quote = clsM[1];
    const cls = clsM[2];

    if (/\bgentrix-push-drawer\b/.test(cls)) return full;

    const isOverlay =
      /\bfixed\b/.test(cls) &&
      (/\binset-0\b/.test(cls) ||
        /\binset-x-0\b/.test(cls) ||
        /\bh-screen\b/.test(cls) ||
        /\bh-full\b/.test(cls) ||
        /\bmin-h-screen\b/.test(cls) ||
        /\btop-(?:0|16|20|24|28)\b/.test(cls) ||
        /\bz-\[[5-9]\d\]\b/.test(cls) ||
        /\bz-(?:40|50|60|70|80|90)\b/.test(cls));
    if (!isOverlay) return full;

    // Twee patronen die er oppervlakkig als "fixed + inset" uitzien maar géén push-down-drawer zijn:
    //  1. Een transparante backdrop (`bg-black/60`, blur etc.) — hoort bovenop de side-drawer te blijven.
    //  2. Een side-drawer (slide-in from right/left) met vaste breedte (`w-72`, `w-[320px]`).
    // Die laten we onaangeraakt; de bestaande `repairBrokenMobileDrawer` regelt daar de Alpine-wiring.
    const looksLikeBackdrop =
      /\bbg-black\/\d/.test(cls) ||
      /\bbg-(?:slate|zinc|neutral|gray|stone)-9\d\d\/\d/.test(cls) ||
      /\bbackdrop-(?:blur|brightness|saturate)\b/.test(cls);
    const looksLikeSideDrawer =
      /\b(?:left-0|right-0)\b/.test(cls) &&
      (/\bw-\d/.test(cls) || /\bw-\[/.test(cls) || /\bmax-w-(?:xs|sm|md|\[)/.test(cls));
    if (looksLikeBackdrop || looksLikeSideDrawer) return full;

    // Strip alle klassen die 'm tot full-screen overlay maken — behoud kleur/layout/spacing.
    let stripped = cls
      .replace(/\bfixed\b/g, "")
      .replace(/\binset-0\b/g, "")
      .replace(/\binset-x-0\b/g, "")
      .replace(/\binset-y-0\b/g, "")
      .replace(/\btop-(?:0|4|8|12|16|20|24|28|32)\b/g, "")
      .replace(/\bleft-0\b/g, "")
      .replace(/\bright-0\b/g, "")
      .replace(/\bbottom-0\b/g, "")
      .replace(/\bh-screen\b/g, "")
      .replace(/\bh-full\b/g, "")
      .replace(/\bmin-h-screen\b/g, "")
      .replace(/\bz-\[\d+\]/g, "")
      .replace(/\bz-(?:10|20|30|40|50|60|70|80|90)\b/g, "")
      // `pt-20/24` was vaak bedoeld om onder de fixed top-bar weg te duiken — niet meer nodig.
      .replace(/\bpt-(?:16|20|24|28|32)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Zorg dat de drawer op desktop verborgen blijft.
    if (!/\b(?:md|lg|sm|xl|2xl):hidden\b/.test(stripped)) {
      stripped = `${stripped} lg:hidden`;
    }
    // `overflow-hidden` crop voor de max-height-animatie.
    if (!/\boverflow-hidden\b/.test(stripped)) {
      stripped = `${stripped} overflow-hidden`;
    }
    // Verticale padding toevoegen als de oorspronkelijke pt-20 weggehaald is en er niets anders staat.
    const hasVerticalPadding =
      /\bpy-\d/.test(stripped) ||
      /\bpt-\d/.test(stripped) ||
      /\bpb-\d/.test(stripped) ||
      /\bp-\d+\b/.test(stripped);
    if (!hasVerticalPadding) {
      stripped = `${stripped} py-4`;
    }

    const newCls = `gentrix-push-drawer ${stripped}`.replace(/\s+/g, " ").trim();

    let nextAttrs = attrs.replace(
      /\bclass\s*=\s*(["'])[^"']*\1/i,
      `class=${quote}${newCls}${quote}`,
    );

    if (!/\bx-transition\b/.test(nextAttrs)) {
      nextAttrs =
        nextAttrs +
        ` x-transition:enter="transition-[max-height,opacity] ease-out duration-300 motion-reduce:transition-none"` +
        ` x-transition:enter-start="max-h-0 opacity-0"` +
        ` x-transition:enter-end="max-h-[80vh] opacity-100"` +
        ` x-transition:leave="transition-[max-height,opacity] ease-in duration-200 motion-reduce:transition-none"` +
        ` x-transition:leave-start="max-h-[80vh] opacity-100"` +
        ` x-transition:leave-end="max-h-0 opacity-0"`;
    }
    if (!/\bx-cloak\b/.test(nextAttrs)) {
      nextAttrs = ` x-cloak${nextAttrs}`;
    }

    return `<${tag}${nextAttrs}>`;
  });

  if (next === fullHeader) return html;
  return html.slice(0, sliced.start) + next + html.slice(sliced.end);
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
  let out = html;
  let guard = 0;
  while (guard++ < 400) {
    let changed = false;
    for (const name of ["header", "nav"] as const) {
      const re = new RegExp(`<${name}\\b`, "gi");
      const m = re.exec(out);
      if (!m) continue;
      const s = sliceOpenTagContent(out, m.index);
      if (!s || s.tagName.toLowerCase() !== name) continue;
      const inner = s.attrs;
      const doubleQuoted = [...inner.matchAll(/\bclass\s*=\s*"([^"]*)"/gi)];
      const singleQuoted = [...inner.matchAll(/\bclass\s*=\s*'([^']*)'/gi)];
      if (doubleQuoted.length + singleQuoted.length < 2) continue;
      const parts: string[] = [];
      for (const mq of doubleQuoted) {
        for (const p of mq[1].split(/\s+/).filter(Boolean)) {
          parts.push(p);
        }
      }
      for (const mq of singleQuoted) {
        for (const p of mq[1].split(/\s+/).filter(Boolean)) {
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
      const newOpen = `<${s.tagName} ${newInner}>`;
      out = `${out.slice(0, m.index)}${newOpen}${out.slice(s.end)}`;
      changed = true;
      break;
    }
    if (!changed) break;
  }
  return out;
}

function tailwindClassHasZIndex(classStr: string): boolean {
  return /\bz-(?:\d+|\[[^\]]+\])\b/i.test(classStr);
}

/**
 * Bouwt class-string voor primaire site-chrome: altijd `sticky top-0` + z-index.
 * `fixed` op dezelfde host wordt verwijderd (studio dwingt sticky i.p.v. fixed top-bar).
 */
function buildStickyPrimaryChromeClasses(existing: string): string {
  let c = existing
    .replace(/\bfixed\b/gi, " ")
    .replace(/\binset-x-0\b/gi, " ")
    .replace(/\bsticky\b/gi, " ")
    .replace(/\btop-0\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  c = `sticky top-0 ${c}`.trim();
  if (!tailwindClassHasZIndex(c)) c = `${c} z-50`.trim();
  return c.replace(/\s+/g, " ").trim();
}

function shouldSkipChromeTagForStickyInjection(tag: string, classStr: string): boolean {
  return tag.toLowerCase() === "nav" && /\babsolute\b/.test(classStr);
}

function injectStickyIntoChromeOpenTag(tag: string, attrs: string): string {
  const clsDouble = attrs.match(/\bclass\s*=\s*"([^"]*)"/i);
  const clsSingle = attrs.match(/\bclass\s*=\s*'([^']*)'/i);
  if (!clsDouble && !clsSingle) {
    const rest = attrs.replace(/^\s+/, "");
    return rest ? `<${tag} class="sticky top-0 z-50" ${rest}>` : `<${tag} class="sticky top-0 z-50">`;
  }
  if (clsDouble) {
    const merged = buildStickyPrimaryChromeClasses(clsDouble[1]);
    const nextAttrs = attrs.replace(/\bclass\s*=\s*"[^"]*"/i, `class="${merged}"`);
    return `<${tag}${nextAttrs}>`;
  }
  const merged = buildStickyPrimaryChromeClasses(clsSingle![1]);
  const nextAttrs = attrs.replace(/\bclass\s*=\s*'[^']*'/i, `class='${merged}'`);
  return `<${tag}${nextAttrs}>`;
}

/**
 * Eerste geschikte `<header>` / `<nav>` in dit fragment: sticky primary chrome.
 * Slaat decoratieve `nav.absolute` over (test: overlay + echte header eronder).
 */
export function injectStickyPrimaryChromeOnceInHtml(html: string): { html: string; applied: boolean } {
  if (!html) return { html, applied: false };
  let scan = 0;
  while (scan < html.length) {
    const rest = html.slice(scan);
    const hi = rest.search(/<header\b/i);
    const ni = rest.search(/<nav\b/i);
    let nextIdx: number | null = null;
    let which: "header" | "nav" | null = null;
    if (hi !== -1 && (ni === -1 || hi < ni)) {
      nextIdx = scan + hi;
      which = "header";
    } else if (ni !== -1) {
      nextIdx = scan + ni;
      which = "nav";
    }
    if (nextIdx === null || which === null) return { html, applied: false };
    const s = sliceOpenTagContent(html, nextIdx);
    if (!s) {
      scan = nextIdx + 1;
      continue;
    }
    const t = s.tagName.toLowerCase();
    if (t !== which) {
      scan = nextIdx + 1;
      continue;
    }
    const cls =
      s.attrs.match(/\bclass\s*=\s*"([^"]*)"/i)?.[1] ?? s.attrs.match(/\bclass\s*=\s*'([^']*)'/i)?.[1] ?? "";
    const clsTrim = cls.trim();
    if (shouldSkipChromeTagForStickyInjection(t, clsTrim)) {
      scan = s.end;
      continue;
    }
    if (/\bsticky\b/i.test(clsTrim) && /\btop-0\b/.test(clsTrim) && tailwindClassHasZIndex(clsTrim)) {
      return { html, applied: true };
    }
    const nextOpen = injectStickyIntoChromeOpenTag(s.tagName, s.attrs);
    return { html: `${html.slice(0, nextIdx)}${nextOpen}${html.slice(s.end)}`, applied: true };
  }
  return { html, applied: false };
}

type SectionRow = { id: string; html: string; name?: string };

/**
 * Zorgt dat gegenereerde Tailwind-landings **één** kleef-balk hebben: eerste geschikte
 * `<header>`/`<nav>` in sectie-volgorde krijgt `sticky top-0` (+ `z-50` als geen `z-*`).
 */
export function enforceStickyPrimaryTailwindChromeAcrossSections(sections: SectionRow[]): SectionRow[] {
  let done = false;
  return sections.map((row) => {
    if (done) return row;
    const { html, applied } = injectStickyPrimaryChromeOnceInHtml(row.html);
    if (applied) done = true;
    return applied ? { ...row, html } : row;
  });
}

function injectGentrixScrollNavMarkerIntoChromeOpenTag(tag: string, attrs: string): string {
  const hasMarker = /\bdata-gentrix-scroll-nav\s*=\s*["']1["']/i.test(attrs);
  const hasScrolledFlag = /\bdata-gentrix-scrolled\s*=/i.test(attrs);
  const markerAttrs = [
    hasMarker ? "" : ' data-gentrix-scroll-nav="1"',
    hasScrolledFlag ? "" : ' data-gentrix-scrolled="0"',
  ]
    .join("")
    .trim();
  if (!markerAttrs) return `<${tag}${attrs}>`;
  return `<${tag}${attrs} ${markerAttrs}>`;
}

/**
 * Markeert de primaire sticky/fixed chrome voor Gentrix-home-nav behavior
 * (transparant op top, semi-transparant bij scroll) zonder andere sites te raken.
 */
export function injectGentrixScrollNavMarkerOnceInHtml(html: string): { html: string; applied: boolean } {
  if (!html) return { html, applied: false };
  let scan = 0;
  while (scan < html.length) {
    const rest = html.slice(scan);
    const hi = rest.search(/<header\b/i);
    const ni = rest.search(/<nav\b/i);
    let nextIdx: number | null = null;
    let which: "header" | "nav" | null = null;
    if (hi !== -1 && (ni === -1 || hi < ni)) {
      nextIdx = scan + hi;
      which = "header";
    } else if (ni !== -1) {
      nextIdx = scan + ni;
      which = "nav";
    }
    if (nextIdx === null || which === null) return { html, applied: false };
    const s = sliceOpenTagContent(html, nextIdx);
    if (!s) {
      scan = nextIdx + 1;
      continue;
    }
    const t = s.tagName.toLowerCase();
    if (t !== which) {
      scan = nextIdx + 1;
      continue;
    }
    const cls =
      s.attrs.match(/\bclass\s*=\s*"([^"]*)"/i)?.[1] ?? s.attrs.match(/\bclass\s*=\s*'([^']*)'/i)?.[1] ?? "";
    const clsTrim = cls.trim();
    if (shouldSkipChromeTagForStickyInjection(t, clsTrim)) {
      scan = s.end;
      continue;
    }
    if (!/\b(sticky|fixed)\b/i.test(clsTrim) || !/\btop-0\b/.test(clsTrim)) {
      scan = s.end;
      continue;
    }
    const nextOpen = injectGentrixScrollNavMarkerIntoChromeOpenTag(s.tagName, s.attrs);
    return { html: `${html.slice(0, nextIdx)}${nextOpen}${html.slice(s.end)}`, applied: true };
  }
  return { html, applied: false };
}

export function enforceGentrixScrollNavMarkerAcrossSections(sections: SectionRow[]): SectionRow[] {
  let done = false;
  return sections.map((row) => {
    if (done) return row;
    const { html, applied } = injectGentrixScrollNavMarkerOnceInHtml(row.html);
    if (applied) done = true;
    return applied ? { ...row, html } : row;
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
    /** Multipage marketing: `/site/{slug}` is de landings-URL, geen in-page `#top` (subpagina's hebben vaak geen `id="top"`). */
    if (rest.length === 1 && cross?.marketingPageKeys && cross.marketingPageKeys.size > 0) {
      return STUDIO_SITE_BASE_PLACEHOLDER;
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
 * Eerste grote hero-`<img>` (object-cover, viewport-hoogte, of absolute full-bleed) krijgt
 * LCP-vriendelijke attributen. Kleine vierkantjes (typische logo's) worden overgeslagen.
 */
function addHeroLcpImageHints(html: string): string {
  let replaced = false;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (replaced) return full;
    if (/\bfetchpriority\s*=/i.test(attrs)) return full;
    const insetFullBleed =
      /\b(?:absolute|fixed)\b/i.test(attrs) &&
      /\binset-0\b/i.test(attrs) &&
      /\bw-full\b/i.test(attrs) &&
      /\bh-full\b/i.test(attrs);
    const looksPhoto =
      /\bobject-(?:cover|contain)\b/i.test(attrs) ||
      /\bmin-h-(?:screen|\[)/i.test(attrs) ||
      /\bh-screen\b/i.test(attrs) ||
      /\bmax-h-\[?\d/i.test(attrs) ||
      insetFullBleed;
    const tinySquare =
      /\bw-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs) &&
      /\bh-(?:6|7|8|9|10|11|12|14|16)\b/.test(attrs);
    if (!looksPhoto || tinySquare) return full;
    replaced = true;
    let a = attrs.trim();
    if (/\bloading\s*=\s*["']lazy["']/i.test(a)) {
      a = a.replace(/\bloading\s*=\s*["']lazy["']/i, 'loading="eager"');
    } else if (!/\bloading\s*=/i.test(a)) {
      a = `${a} loading="eager"`;
    }
    if (!/\bdecoding\s*=/i.test(a)) {
      a = `${a} decoding="async"`;
    }
    if (!/\bfetchpriority\s*=/i.test(a)) {
      a = `${a} fetchpriority="high"`;
    }
    return `<img ${a}>`;
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
  options?: PostProcessClaudeTailwindPageOptions,
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

  const landing = postProcessClaudeTailwindPage(
    { config: page.config, sections: page.sections },
    { crossPage, gentrixScrollNav: options?.gentrixScrollNav },
  );
  const contact = postProcessClaudeTailwindPage(
    { config: page.config, sections: page.contactSections },
    { crossPage, gentrixScrollNav: options?.gentrixScrollNav },
  );
  const marketingPages =
    marketingPagesRaw != null && Object.keys(marketingPagesRaw).length > 0
      ? Object.fromEntries(
          Object.entries(marketingPagesRaw).map(([k, secs]) => [
            k,
            postProcessClaudeTailwindPage(
              { config: page.config, sections: secs },
              { crossPage, gentrixScrollNav: options?.gentrixScrollNav },
            ).sections,
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
  /**
   * Alleen voor Gentrix-home generatie: markeer primaire sticky nav voor
   * transparant-op-top + subtiel glas bij scroll.
   */
  gentrixScrollNav?: boolean;
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
  for (const id of collectHtmlElementIds(combined)) {
    validIds.add(id);
  }

  const sectionsLinked = withIds.map((row, sectionIndex) => {
    const html0 = withRootIdOnSectionHtml(row.html, row.id);
    const html0b = repairSamePagePathHrefsInHtml(html0, validIds, cross);
    const html1 = repairInternalLinksInHtml(html0b, validIds, cross);
    const html2 = mergeDuplicateClassOnChromeTags(html1);
    const html2b = fixAlpineNavToggleDefaultsInXData(html2);
    const html2c0 = repairBrokenMobileDrawer(html2b);
    /** Zelfde stap als in `sanitizeTailwindFragment` (na drawer-repair, vóór push-down): anders blijft AI-markup met `flex-col` + gedraaide spans in de DB staan totdat er gesanitized wordt. */
    const html2c0a = repairHeaderMobileMenuButton(html2c0);
    const html2c0a1 = alignChromeNavMdLgBreakpoints(html2c0a);
    const html2c0b = convertMobileDrawerToPushDown(html2c0a1);
    const html2ba = ensureAlpineMobileToggleButtonHasLgHidden(html2c0b);
    const html2bb = ensureAlpineMobileOverlayHasLgHidden(html2ba);
    const html2c = stripDecorativeScrollCueMarkup(html2bb);
    const html2d = stripStudioMarqueeMarkupFromHtml(html2c);
    let html3: string;
    if (row.id === "hero") {
      html3 = addHeroLcpImageHints(
        addResponsiveSrcsetToHeroSupabaseRenderImages(
          promoteHeroSupabaseBackgroundUrlToImg(
            rewriteSupabaseStorageObjectUrlsForWebDelivery(ensureHeroRootMinViewportClass(html2d)),
          ),
        ),
      );
    } else {
      /** Eerste sectie vaak (deels) above-the-fold; vanaf sectie 2 standaard lazy voor bandbreedte. */
      html3 =
        sectionIndex > 0 ? addDefaultLazyLoadingToBelowFoldSectionImages(html2d) : html2d;
    }
    return { ...row, html: html3 };
  });

  const sectionsDeduped = dedupeExcessTelAndWhatsAppAnchorsAcrossSections(sectionsLinked);
  const sectionsSticky = enforceStickyPrimaryTailwindChromeAcrossSections(sectionsDeduped);
  const sectionsGentrixNav = options?.gentrixScrollNav
    ? enforceGentrixScrollNavMarkerAcrossSections(sectionsSticky)
    : sectionsSticky;

  return { ...page, sections: sectionsGentrixNav };
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
  options?: Pick<PostProcessClaudeTailwindPageOptions, "gentrixScrollNav">,
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
  const out = postProcessClaudeTailwindPage(page, options);
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
    .filter((slug) => slug.trim().toLowerCase() !== "faq")
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
// Hero: dubbele #hero + AOS op buitenste hero (layout/stacking in preview)
// ---------------------------------------------------------------------------

/** Verwijdert `data-aos*` en `data-animation` alleen op de **open-tag** string (geen body-HTML). */
function stripRootHeroScrollMotionAttrsFromOpenTag(openTag: string): string {
  let t = openTag.replace(/\sdata-aos(?:-[a-z0-9-]+)?\s*=\s*(["'])[^"']*\1/gi, "");
  t = t.replace(/\sdata-animation\s*=\s*(["'])[^"']*\1/gi, "");
  return t;
}

function stripDuplicateHeroIdFromOpenTag(openTag: string): string {
  return openTag.replace(/\s\bid\s*=\s*(["'])hero\1/gi, ' data-gentrix-secondary-hero="1"');
}

/**
 * Site-assistent / model kan per ongeluk **twee** `<section id="hero">` leveren of AOS op de **buitenste**
 * hero zetten. Dubbele id's breken anchors; AOS (`transform`/`opacity`) op de volledige hero-stack laat
 * een tweede (geneste) hero-blad eroverheen schuiven.
 *
 * - Eerste `id="hero"`: `data-aos*` en `data-animation` van de **open-tag** verwijderd (animatie hoort op inner wrappers).
 * - Tweede en volgende `id="hero"`: `id` → `data-gentrix-secondary-hero="1"` (geen dubbele id in het fragment).
 */
export function normalizeStudioHeroDomIdsAndRootMotion(html: string): string {
  if (!html || !/<section\b/i.test(html) || !/\bid\s*=\s*["']hero["']/i.test(html)) {
    return html;
  }
  let pos = 0;
  let seenHeroId = false;
  const pieces: string[] = [];
  while (pos < html.length) {
    const idx = html.toLowerCase().indexOf("<section", pos);
    if (idx === -1) {
      pieces.push(html.slice(pos));
      break;
    }
    pieces.push(html.slice(pos, idx));
    const end = findHtmlOpenTagEnd(html, idx);
    let open = html.slice(idx, end);
    if (/\bid\s*=\s*["']hero["']/i.test(open)) {
      if (seenHeroId) {
        open = stripDuplicateHeroIdFromOpenTag(open);
      } else {
        open = stripRootHeroScrollMotionAttrsFromOpenTag(open);
        seenHeroId = true;
      }
    }
    pieces.push(open);
    pos = end;
  }
  return pieces.join("");
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
  s = stripHallucinatedStockPhotoUrlsInHtml(s);
  s = cleanupStrippedStockMarkup(s);
  return s;
}

function mapSectionsImageFree(sections: TailwindSection[]): TailwindSection[] {
  return sections.map((s) => ({ ...s, html: studioImageFreeSingleHtml(s.html) }));
}

/** Na generatie: verwijdert alle raster-/embed-media en resterende automatisch ingevulde stock-foto-URL's (deterministisch). */
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

export function removeDuplicateAlpineNavScopeInHeader(html: string): string {
  let cursor = 0;
  let out = "";
  let pos = 0;
  while (pos < html.length) {
    const m = /<header\b/gi.exec(html.slice(pos));
    if (!m) break;
    const abs = pos + m.index;
    const w = walkBalancedSameLocalBlock(html, abs, "header");
    if (!w) {
      pos = abs + 1;
      continue;
    }
    const openSlice = sliceOpenTagContent(html, abs);
    out += html.slice(cursor, w.start);
    if (!openSlice?.attrs || !/\bx-data\s*=/i.test(openSlice.attrs)) {
      out += w.block;
    } else {
      const block = w.block;
      const innerStart = findHtmlOpenTagEnd(block, 0);
      const closeExec = /<\/header\s*>/i.exec(block.slice(innerStart));
      if (!closeExec) {
        out += block;
      } else {
        const innerEnd = innerStart + closeExec.index;
        const inner = block.slice(innerStart, innerEnd);
        const cleaned = inner.replace(/\s*x-data\s*=\s*["'][^"']*\bnavOpen\b[^"']*["']/gi, "");
        out += block.slice(0, innerStart) + cleaned + block.slice(innerEnd);
      }
    }
    cursor = w.end;
    pos = w.end;
  }
  out += html.slice(cursor);
  return out;
}
