/**
 * Automatische mobiele navigatie (Alpine): standaard **ingeklapt**, alleen op kleine viewports
 * de drie-strepjes-knop; desktop (`lg+`) toont het horizontale menu — geen hamburger op breed scherm.
 */
import { ALPINE_NAV_TOGGLE_KEYS } from "@/lib/ai/generate-site-postprocess";
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_BRAND_MARK_ATTR } from "@/lib/site/brand-logo-inject";
import { STUDIO_CONTACT_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";
import type { GeneratedLogoSet } from "@/types/logo";

/**
 * Zelfde sleutels als `fixAlpineNavToggleDefaultsInXData`: als het model al Alpine-navstate in `x-data` zet,
 * geen automatische header injecteren (anders dubbele navbar, vooral op desktop).
 */
const XDATA_HAS_NAV_TOGGLE_RE = new RegExp(
  `\\bx-data\\s*=\\s*["'][^"']*\\b(?:${ALPINE_NAV_TOGGLE_KEYS.join("|")})\\s*:`,
  "i",
);
const GENERIC_XDATA_RE = /\bx-data\s*=\s*["'][^"']*["']/i;

/** Alpine / x-html: klik-handler op dezelfde `<button>`-tag (attribuutvolgorde willekeurig). */
const BUTTON_HAS_ALPINE_CLICK_RE = /@click|x-on:click/i;

/** `lg:hidden`-achtige menuknop in class. */
const BUTTON_CLASS_HAS_RESPONSIVE_HIDDEN_RE = /\b(?:sm|md|lg|xl|2xl):hidden\b/i;

/**
 * Echte werkende mobiele toggle: `x-data` met een Alpine mobiele-toggleknop (`*:hidden` of menu-achtige aria)
 * en `@click` / `x-on:click` op die knop.
 *
 * Deze detectie is bewust generieker dan alleen de bekende toggle-keys, zodat valide custom Alpine-staten
 * zoals `x-data="{ menuVisible: false }"` ook niet onterecht worden overschreven.
 */
export function headerHasWiredAlpineMobileMenuToggle(fromHeader: string): boolean {
  if (!GENERIC_XDATA_RE.test(fromHeader)) return false;
  const buttonRe = /<button\b[^>]{0,8000}>/gi;
  let m: RegExpExecArray | null;
  while ((m = buttonRe.exec(fromHeader)) !== null) {
    const tag = m[0];
    const looksMobileControl =
      BUTTON_CLASS_HAS_RESPONSIVE_HIDDEN_RE.test(tag) ||
      /\baria-(?:label|expanded)\s*=\s*["'][^"']*(?:enu|menu|open|sluiten|close|openen|expand|collapse)/i.test(
        tag,
      );
    if (!looksMobileControl) continue;
    if (BUTTON_HAS_ALPINE_CLICK_RE.test(tag)) return true;
  }
  return false;
}

/**
 * Gegenereerde hero/site-header die er **visueel uitgebreid** uitziet — dan géén utilitaire
 * `data-gentrix-auto-mobile-nav`-balk injecteren (die verbergt de echte header via duplicate-CSS
 * en voelt als “zwarte balk met tekst”).
 */
export function headerAppearsDesigned(scanSlice: string): boolean {
  const relIdx = scanSlice.search(/<header\b/i);
  if (relIdx < 0) return false;
  /** Eerste ~22k vanaf `<header>`: blur/gradient zitten vaak op een inner `div`, niet op de open tag. */
  const w = scanSlice.slice(relIdx, Math.min(scanSlice.length, relIdx + 22_000));
  const openM = w.match(/^<header\b[^>]{0,4000}>/i);
  const openTag = openM?.[0] ?? "";
  if (
    /backdrop-blur|bg-gradient|\bfrom-\w+|via-\w+|\bto-\w+|shadow-(2xl|xl|lg)|\b(shadow-sm|shadow-md|shadow-lg|shadow-xl)\b|ring-1|border-b|border-white\/|border-zinc\/|bg-slate-950\/|bg-black\/|mix-blend-/i.test(
      w,
    )
  ) {
    return true;
  }
  if (openTag.length >= 130) return true;
  if (/<img\b/i.test(w)) return true;
  if (/<svg\b/i.test(w) || /\bdata-lucide\s*=/i.test(w)) return true;
  const hrefLinks = w.match(/<a\b[^>]*\bhref\s*=/gi) ?? [];
  if (hrefLinks.length >= 2) return true;
  if (/<nav\b/i.test(w) && hrefLinks.length >= 1 && /\b(lg|xl):flex\b/i.test(w)) return true;
  return false;
}

/** Herken onze eigen geïnjecteerde balk (geen dubbele injectie). */
const AUTO_NAV_ATTR = 'data-gentrix-auto-mobile-nav="1"';

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractHeaderNavLinks(bodyInnerHtml: string): { href: string; label: string }[] {
  const headerMatch = bodyInnerHtml.match(/<header\b[^>]*>[\s\S]*?<\/header>/i);
  const headerHtml = headerMatch?.[0] ?? bodyInnerHtml;
  const navMatch = headerHtml.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i);
  const navHtml = navMatch?.[0] ?? headerHtml;
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const out: { href: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(navHtml)) !== null) {
    const attrs = m[1];
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (!href) continue;
    if (/^javascript:/i.test(href)) continue;
    const label = stripHtmlTags(m[2]);
    if (!label) continue;
    out.push({ href, label });
  }
  return out;
}

/** Zelfde normalisatie als `buildStudioSinglePageInternalNavScript` (`slugifyNavKey`) voor `#hash`-links. */
function studioNavHashFromSectionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Eerste site-`<header>` (meestal hero-nav); beperkte lengte i.v.m. performance. */
function sliceFirstHeaderHtml(bodyInnerHtml: string): string {
  const idx = bodyInnerHtml.search(/<header\b/i);
  if (idx < 0) return "";
  return bodyInnerHtml.slice(idx, Math.min(bodyInnerHtml.length, idx + 32_000));
}

/** Eerste section-slice voor gevallen zonder top-level `<header>` (hero bevat soms de nav als losse div). */
function sliceFirstSectionHtml(bodyInnerHtml: string): string {
  const idx = bodyInnerHtml.search(/<section\b/i);
  if (idx < 0) return "";
  return bodyInnerHtml.slice(idx, Math.min(bodyInnerHtml.length, idx + 32_000));
}

function classLooksLikeSideDrawer(classValue: string): boolean {
  const cls = classValue.trim();
  if (!cls) return false;
  if (!/\bfixed\b/.test(cls)) return false;
  if (!/\b(?:right-0|left-0)\b/.test(cls)) return false;
  return /\bh-full\b|\binset-y-0\b|(?:\btop-0\b[\s\S]*\bbottom-0\b)/.test(cls);
}

function classLooksLikeDrawerBackdrop(classValue: string): boolean {
  const cls = classValue.trim();
  if (!cls) return false;
  if (!/\bfixed\b/.test(cls) || !/\binset-0\b/.test(cls)) return false;
  return /bg-(?:black|slate|zinc|neutral|gray)|backdrop|opacity-\d+/i.test(cls);
}

/**
 * Vaste top-nav zonder `<header>` (div/role=banner) — niet overschrijven met de utilitaire balk.
 */
function bodyHasEarlyTopNavWithoutHeaderTag(bodyInnerHtml: string): boolean {
  const probe = bodyInnerHtml.slice(0, 14_000);
  if (/\brole\s*=\s*["']banner["']/i.test(probe)) return true;
  const navIdx = probe.search(/<nav\b/i);
  if (navIdx < 0 || navIdx > 7_000) return false;
  const beforeNav = probe.slice(0, navIdx);
  return /\b(fixed|sticky)\b/i.test(beforeNav) && /\btop-0\b/i.test(beforeNav);
}

/**
 * AI-output kan een "mobiele" right/left drawer als los vast paneel zetten zonder werkende toggle-state.
 * In dat geval wél auto-nav injecteren, ook als de header verder vaste links bevat.
 */
function headerHasLikelyBrokenMobileDrawer(headerSlice: string): boolean {
  const hasSideDrawer = /<(?:div|aside|nav)\b([^>]*)>/gi.test(headerSlice)
    ? [...headerSlice.matchAll(/<(?:div|aside|nav)\b([^>]*)>/gi)].some((m) => {
        const attrs = m[1] ?? "";
        const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
        return classLooksLikeSideDrawer(cls);
      })
    : false;
  if (!hasSideDrawer) return false;
  const hasMenuShow = /\bx-show\s*=\s*["'][^"']*(?:open|menu|nav|drawer|mobile)[^"']*["']/i.test(headerSlice);
  const hasMenuToggle = /<button\b[^>]*(?:@click|x-on:click)\s*=\s*["'][^"']*(?:open|menu|nav|drawer|mobile)[^"']*["'][^>]*>/i.test(
    headerSlice,
  );
  return !hasMenuShow || !hasMenuToggle;
}

function bodyHasLikelyBrokenMobileDrawer(bodyInnerHtml: string): boolean {
  const headerSlice = sliceFirstHeaderHtml(bodyInnerHtml);
  if (headerSlice && headerHasLikelyBrokenMobileDrawer(headerSlice) && !headerHasWiredAlpineMobileMenuToggle(headerSlice)) {
    return true;
  }
  const firstSection = sliceFirstSectionHtml(bodyInnerHtml);
  return !!(
    firstSection &&
    headerHasLikelyBrokenMobileDrawer(firstSection) &&
    !headerHasWiredAlpineMobileMenuToggle(firstSection)
  );
}

export function stripLikelyBrokenMobileDrawerBlocks(html: string): string {
  return html.replace(/<(div|aside|nav)\b([^>]*)>[\s\S]*?<\/\1>/gi, (full, _tag: string, attrs: string) => {
    if (/\b(id|data-gentrix-auto-mobile-nav)\s*=\s*["'](?:gentrix-site-mobile-sheet|1)["']/i.test(attrs)) return full;
    const cls = /\bclass\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? "";
    const isBrokenDrawer = classLooksLikeSideDrawer(cls);
    const isBrokenBackdrop = classLooksLikeDrawerBackdrop(cls);
    if (!isBrokenDrawer && !isBrokenBackdrop) return full;
    if (/\bx-show\s*=/.test(attrs)) return full;
    return "";
  });
}

/**
 * Broken-drawer-pad: verwijder fragiele AI-header/panelen en laat daarna één robuuste auto-nav injecteren.
 * Dit is bewust betrouwbaarder dan per-template regex repareren van willekeurige markup.
 */
export function replaceBrokenDrawerChromeWithAutoNavSource(bodyInnerHtml: string): string {
  if (!bodyHasLikelyBrokenMobileDrawer(bodyInnerHtml)) return bodyInnerHtml;
  let out = bodyInnerHtml;

  out = out.replace(/<header\b[\s\S]*?<\/header>/gi, (header) => {
    if (headerHasLikelyBrokenMobileDrawer(header)) return "";
    return header;
  });

  out = stripLikelyBrokenMobileDrawerBlocks(out);
  return out;
}

/**
 * `true` = utilitaire auto-navbar **injecteren** (alleen bij gebrek aan bruikbare bestaande top-nav).
 *
 * Beleid: zodra er al een **werkend** mobiel Alpine-menu staat, of er vroeg in de body al een vaste top-`<nav>`
 * staat, **niet** injecteren. Een header die er alleen "designed" uitziet is niet genoeg: die kan alsnog een
 * gebroken mobiel menu hebben (bijv. losse fixed right drawer zonder toggle/scope).
 */
export function shouldInjectStudioAutoMobileNav(bodyInnerHtml: string): boolean {
  if (/data-gentrix-auto-mobile-nav\s*=\s*/i.test(bodyInnerHtml)) return false;
  const win = sliceFirstHeaderHtml(bodyInnerHtml);
  if (!win) {
    /**
     * Sommige output heeft geen `<header>` op body-niveau: nav/drawer staat als losse fixed kolom in de eerste
     * hero-`<section>`. Als die drawer niet bekabeld is, forceren we auto-nav injectie i.p.v. vroeg te stoppen.
     */
    const firstSection = sliceFirstSectionHtml(bodyInnerHtml);
    const hasDrawerInSection = headerHasLikelyBrokenMobileDrawer(firstSection);
    if (hasDrawerInSection && !headerHasWiredAlpineMobileMenuToggle(firstSection)) return true;
    return !bodyHasEarlyTopNavWithoutHeaderTag(bodyInnerHtml);
  }
  const hasWiredMobileToggle = headerHasWiredAlpineMobileMenuToggle(bodyInnerHtml);
  if (hasWiredMobileToggle) return false;
  /**
   * Belangrijk: "designed" alleen is niet genoeg om injectie te skippen.
   * Veel AI-headers ogen visueel rijk maar missen een werkende mobiele toggle/scope.
   */
  const hasLikelyBrokenDrawer = headerHasLikelyBrokenMobileDrawer(win);
  const hrefCount = (win.match(/<a\b[^>]*\bhref\s*=/gi) ?? []).length;
  if (/\b(fixed|sticky)\b/i.test(win) && hrefCount >= 1 && !hasLikelyBrokenDrawer) return false;
  return true;
}

/**
 * Verbergt een eventuele tweede `<header>` in de eerste sectie (vaak de AI-hero-nav) zodra de
 * automatische balk is geïnjecteerd — op **alle** breakpoints. Alleen “op mobiel” verbergen gaf
 * dubbele nav + open mobiel paneel in desktop-studio-preview.
 *
 * Ook: Alpine x-show doet inline display, dus we moeten forceren dat mobiele elementen op lg+ verborgen zijn.
 */
export const STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS = `body > header[${AUTO_NAV_ATTR}] ~ header,
body > header[${AUTO_NAV_ATTR}] ~ section:first-of-type header {
  display: none !important;
}

/* Verberg de rechterkant navbars - fixed positioning right-0 */
div.fixed.top-0.right-0,
div[class*="fixed"][class*="top-0"][class*="right-0"],
/* Alle fixed els met lage/hoge width aan rechterkant */
div[class*="fixed"][class*="right-0"][class*="w-"],
div[class*="fixed"][class*="right-0"][class*="h-full"],
/* Sidebar-achtige divs */
div[class*="fixed"][class*="inset-y-0"][class*="right-0"],
div[class*="fixed"][class*="right-0"][class*="z-"],
/* Alpine-based mobiele menu drawers (niet elke section-fixed: breekt hero-video/gradient-lagen). */
div[class*="fixed"][x-show],

/* Verberg ALLE gegenereerde navbars */
section header,
section nav,
body > header:not([${AUTO_NAV_ATTR}]),
body > nav,
/* Niet de geïnjecteerde sheet (#gentrix-site-mobile-sheet); die heeft ook aria-label met "menu". */
body > header:not([${AUTO_NAV_ATTR}]) nav[aria-label*="enu"],
body > header:not([${AUTO_NAV_ATTR}]) nav[aria-label*="Menu"],
section nav[aria-label*="enu"],
section nav[aria-label*="Menu"] {
  display: none !important;
}

/* Geïnjecteerde mobiele sheet: expliciet tonen (wint van bovenstaande nav-*-regels). */
header[${AUTO_NAV_ATTR}] #gentrix-site-mobile-sheet nav[aria-label="Mobiel menu"],
header[${AUTO_NAV_ATTR}] #gentrix-site-mobile-sheet nav[aria-label="Mobile menu"] {
  display: flex !important;
}

/* VERBERG NIET: backdrop en mobile sheet — Alpine x-show moet die kunnen schakelen! */

/* Force hide Alpine mobile sheets/drawers on desktop (lg+) — x-show inline display overrides lg:hidden */
@media (min-width: 1024px) {
  /* Hamburger knop verbergen op desktop */
  header[${AUTO_NAV_ATTR}] button[class*="lg:hidden"],
  header[${AUTO_NAV_ATTR}] button.lg\\:hidden,
  /* Mobiele nav buiten header */
  body > div[class*="fixed"][class*="inset"][class*="lg:hidden"],
  body > div[class*="fixed"][class*="inset"][x-show],
  body > div.pointer-events-auto:has(nav[aria-label="Mobiel menu"]),
  body > div.pointer-events-auto:has(nav[aria-label="Mobile menu"]),
  body > header[${AUTO_NAV_ATTR}] ~ * div[class*="fixed"][class*="inset"][class*="lg:hidden"],
  body > header[${AUTO_NAV_ATTR}] ~ * nav[class*="lg:hidden"],
  body > nav[class*="lg:hidden"],
  body > header[${AUTO_NAV_ATTR}] ~ * [role="navigation"].lg\\:hidden {
    display: none !important;
  }
}`;

/**
 * Body gebruikt `text-slate-900`; ontbrekende Tailwind-utilities of globale `a`-regels uit secties
 * kunnen mobiele menu-links donker maken op donkere sheet → onzichtbaar. Deze safeguard wint van die bleed.
 */
export const STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS = `header[data-gentrix-auto-mobile-nav="1"] #gentrix-site-mobile-sheet a:not([class*="bg-white"]) {
  color: rgb(248 250 252) !important;
}
header[data-gentrix-auto-mobile-nav="1"] #gentrix-site-mobile-sheet a[class*="bg-white"] {
  color: rgb(15 23 42) !important;
}`;

/**
 * Was: `display:none!important` op `section > header` fixed/inset-lagen om oude AI-sidebars te verbergen.
 * Dat brak **alle** mobiele menu’s: niet alleen tegen Alpine `x-show`, ook tegen `:class` / `hidden`, en
 * elke selector was te breed. Bewust leeg — gebruik auto-nav (`shouldInjectStudioAutoMobileNav`) of
 * editor-self-review i.p.v. globale header-CSS.
 */
export const STUDIO_GENERATED_SITE_NAVBAR_CLEANUP_CSS = "";

const NAV_BRAND_TEXT_MAX = 48;

function clampNavBrandText(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= NAV_BRAND_TEXT_MAX ? t : t.slice(0, NAV_BRAND_TEXT_MAX).trimEnd();
}

function defaultBrandLabel(pageConfig: TailwindPageConfig | null | undefined): string {
  if (!pageConfig) return "Website";
  if (isLegacyTailwindPageConfig(pageConfig)) {
    const t = pageConfig.themeName.trim();
    return clampNavBrandText(t.length > 0 ? t : "Website") || "Website";
  }
  /* `style` is een lange ontwerpbriefing — nooit als zichtbaar merk in de balk. */
  return "Website";
}

export type StudioAutoMobileNavBrandOptions = {
  /** Zichtbare merktekst (bv. klant- of sitenaam uit de studio). */
  navBrandLabel?: string | null;
  /** Premium-logo: zelfde primary-SVG als elders in de site. */
  logoSet?: GeneratedLogoSet | null;
};

function resolveNavBrandText(
  pageConfig: TailwindPageConfig | null | undefined,
  brandOpts?: StudioAutoMobileNavBrandOptions | null,
): string {
  const explicit = clampNavBrandText(brandOpts?.navBrandLabel?.trim() ?? "");
  if (explicit) return explicit;
  return defaultBrandLabel(pageConfig);
}

function buildAutoNavBrandBlock(
  pageConfig: TailwindPageConfig | null | undefined,
  brandOpts?: StudioAutoMobileNavBrandOptions | null,
): string {
  const label = resolveNavBrandText(pageConfig, brandOpts);
  const primary = brandOpts?.logoSet?.variants?.primary?.trim();
  if (primary) {
    const aria = escapeHtmlText(brandOpts?.logoSet?.brandName?.trim() || label);
    return `<a href="#top" class="inline-flex min-w-0 shrink-0 items-center focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 rounded-sm" aria-label="${aria}"><span class="inline-flex h-8 max-w-[min(100%,280px)] min-w-0 items-center text-white [&_svg]:h-8 [&_svg]:max-h-8 [&_svg]:w-auto" ${STUDIO_BRAND_MARK_ATTR}="1">${primary}</span></a>`;
  }
  const esc = escapeHtmlText(label);
  return `<a href="#top" class="min-w-0 max-w-[min(100%,12rem)] shrink-0 truncate text-lg font-semibold tracking-tight text-white sm:max-w-[min(100%,16rem)]" title="${esc}">${esc}</a>`;
}

export function buildStudioAutoMobileNavHeaderHtml(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
  brandOpts?: StudioAutoMobileNavBrandOptions | null,
  existingNavLinks?: { href: string; label: string }[] | null,
): string {
  const brandBlock = buildAutoNavBrandBlock(pageConfig ?? null, brandOpts ?? null);
  const sourceLinks =
    existingNavLinks && existingNavLinks.length > 0
      ? existingNavLinks.map((link) => ({ href: link.href, label: escapeHtmlText(link.label.trim().slice(0, 48) || link.href) }))
      : sections
          .map((s) => {
            const hash = studioNavHashFromSectionName(s.sectionName);
            if (!hash) return null;
            const label = escapeHtmlText(s.sectionName.trim().slice(0, 48) || hash);
            return { href: `#${hash}`, label };
          })
          .filter((x): x is { href: string; label: string } => x != null);

  const unique: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const it of sourceLinks) {
    if (seen.has(it.href)) continue;
    seen.add(it.href);
    unique.push(it);
    if (unique.length >= 8) break;
  }

  const linksHtml = unique
    .map(
      (it) =>
        `<a href="${escapeHtmlText(it.href)}" class="text-white/90 transition-colors hover:text-white">${it.label}</a>`,
    )
    .join("\n      ");

  const mobileLinksHtml = unique
    .map(
      (it) =>
        `<a href="${escapeHtmlText(it.href)}" class="block w-full rounded-xl px-4 py-3.5 text-left text-[15px] font-medium tracking-tight text-white transition-colors hover:bg-white/10 active:bg-white/15" @click="navOpen = false">${it.label}</a>`,
    )
    .join("\n      ");

  const desktopNavBlock =
    unique.length > 0
      ? `<nav class="hidden items-center gap-8 text-sm font-medium lg:flex" aria-label="Hoofdmenu">
      ${linksHtml}
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90">Contact</a>
    </nav>`
      : `<nav class="hidden items-center gap-6 text-sm font-medium lg:flex" aria-label="Hoofdmenu">
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-white/90">Contact</a>
    </nav>`;

  const mobileSheetNavBlock =
    unique.length > 0
      ? `<nav class="flex flex-col gap-0.5" aria-label="Mobiel menu">
      ${mobileLinksHtml}
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="mt-3 rounded-full bg-white px-4 py-3.5 text-center text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white/95" @click="navOpen = false">Contact</a>
    </nav>`
      : `<nav class="flex flex-col gap-0.5" aria-label="Mobiel menu">
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-3.5 text-center text-sm font-semibold text-slate-900 shadow-md transition hover:bg-white/95" @click="navOpen = false">Contact</a>
    </nav>`;

  return `<header id="gentrix-auto-site-header" ${AUTO_NAV_ATTR} data-studio-skip-nav-tone class="fixed inset-x-0 top-0 z-[80] border-b border-white/10 bg-slate-950/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md" x-data="{ navOpen: false }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:gap-4 md:px-6">
    ${brandBlock}
    ${desktopNavBlock}
    <button type="button" class="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ring-1 ring-white/15 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden" @click="navOpen = !navOpen" :aria-expanded="navOpen.toString()" aria-controls="gentrix-site-mobile-sheet">
      <span class="sr-only">Menu</span>
      <span class="relative block h-5 w-5 shrink-0" aria-hidden="true">
        <span x-show="!navOpen" x-transition.opacity.duration.150ms class="absolute inset-0 flex flex-col justify-center gap-[5px]">
          <span class="h-0.5 w-full rounded-full bg-white"></span>
          <span class="h-0.5 w-full rounded-full bg-white"></span>
          <span class="h-0.5 w-full rounded-full bg-white"></span>
        </span>
        <span x-show="navOpen" x-cloak x-transition.opacity.duration.150ms class="absolute inset-0 flex items-center justify-center">
          <span class="absolute h-0.5 w-5 rotate-45 rounded-full bg-white"></span>
          <span class="absolute h-0.5 w-5 -rotate-45 rounded-full bg-white"></span>
        </span>
      </span>
    </button>
  </div>
  <div class="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-md lg:hidden" x-show="navOpen" x-cloak x-transition.opacity @click="navOpen = false" aria-hidden="true"></div>
  <div id="gentrix-site-mobile-sheet" class="fixed inset-x-0 top-16 z-[70] max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4 pb-8 pt-5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10 lg:hidden" x-show="navOpen" x-cloak x-transition @click.stop>
    ${mobileSheetNavBlock}
  </div>
</header>`;
}
