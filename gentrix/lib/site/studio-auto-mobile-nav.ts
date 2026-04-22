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

const XDATA_HAS_NAV_TOGGLE_RE = new RegExp(
  `\\bx-data\\s*=\\s*["'][^"']*\\b(?:${ALPINE_NAV_TOGGLE_KEYS.join("|")})\\s*:`,
  "i",
);
const GENERIC_XDATA_RE = /\bx-data\s*=\s*["'][^"']*["']/i;

const BUTTON_HAS_ALPINE_CLICK_RE = /@click|x-on:click/i;

const BUTTON_CLASS_HAS_RESPONSIVE_HIDDEN_RE = /\b(?:sm|md|lg|xl|2xl):hidden\b/i;

export function headerHasWiredAlpineMobileMenuToggle(fromHeader: string): boolean {
  if (!GENERIC_XDATA_RE.test(fromHeader)) return false;

  // Alleen een x-show-drawer + x-data telt niet als “bekabeld” zonder zichtbare menuknop met @click —
  // veel AI-headers hebben wél een sheet, geen bruikbare hamburger (die blijft dan uit de DOM-qua zicht).

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
 * AI levert soms een menuknop met `md:/lg:…:hidden` of aria-label, maar **zonder** `@click` op die knop.
 * Dan is er geen werkende toggle, maar `headerHasDesktopOnlyNavWithoutSmallScreenMenuButton` is ook false
 * (er “is” wel een knop) — waardoor we anders géén Gentrix-auto-nav injecteerden.
 *
 * `scopeForXData` = vaak volledige `body`-inner: `x-data` staat soms op een wrapper vóór `<header>`.
 */
export function headerHasUnwiredMobileMenuButton(fromHeader: string, scopeForXData: string = fromHeader): boolean {
  if (!GENERIC_XDATA_RE.test(scopeForXData)) return false;
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
    if (!BUTTON_HAS_ALPINE_CLICK_RE.test(tag)) return true;
  }
  return false;
}

/** `x-show="navOpen"` / sheet aanwezig maar geen enkele `@click` die die state zet (lege div, vergeten handler). */
function headerHasAlpineNavOpenSheetWithoutNavToggle(fromHeader: string, scopeForXData: string): boolean {
  if (!GENERIC_XDATA_RE.test(scopeForXData)) return false;
  if (!/\bx-show\s*=\s*["'][^"']*(?:navOpen|menuOpen)\b/i.test(fromHeader)) return false;
  const probe = scopeForXData.slice(0, 48_000);
  if (
    /@click\s*=\s*["'][^"']*(?:navOpen|menuOpen)\b/i.test(probe) ||
    /x-on:click\s*=\s*["'][^"']*(?:navOpen|menuOpen)\b/i.test(probe)
  ) {
    return false;
  }
  return true;
}

export function headerAppearsDesigned(scanSlice: string): boolean {
  const relIdx = scanSlice.search(/<header\b/i);
  if (relIdx < 0) return false;
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

function studioNavHashFromSectionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sliceFirstHeaderHtml(bodyInnerHtml: string): string {
  const idx = bodyInnerHtml.search(/<header\b/i);
  if (idx < 0) return "";
  return bodyInnerHtml.slice(idx, Math.min(bodyInnerHtml.length, idx + 32_000));
}

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

function bodyHasEarlyTopNavWithoutHeaderTag(bodyInnerHtml: string): boolean {
  const probe = bodyInnerHtml.slice(0, 14_000);
  if (/\brole\s*=\s*["']banner["']/i.test(probe)) return true;
  const navIdx = probe.search(/<nav\b/i);
  if (navIdx < 0 || navIdx > 7_000) return false;
  const beforeNav = probe.slice(0, navIdx);
  return /\b(fixed|sticky)\b/i.test(beforeNav) && /\btop-0\b/i.test(beforeNav);
}

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
  return html;
}

export function replaceBrokenDrawerChromeWithAutoNavSource(bodyInnerHtml: string): string {
  return bodyInnerHtml;
}

/**
 * Typisch AI-patroon: `<nav class="hidden … lg:flex">` = links alleen op desktop; op mobiel geen menu
 * tenzij er een knop met `sm|md|lg|…:hidden` (zichtbaar op kleine viewport) staat.
 */
function headerHasDesktopOnlyNavWithoutSmallScreenMenuButton(headerHtml: string): boolean {
  const navOpen = headerHtml.match(/<nav\b[^>]*>/i)?.[0] ?? "";
  const cls = navOpen.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const desktopOnlyNav =
    /\bhidden\b/.test(cls) &&
    /\b(?:md|lg|xl|2xl):flex\b/.test(cls) &&
    !/\b(?:sm|md|lg|xl|2xl):hidden\b/.test(cls);
  if (!desktopOnlyNav) return false;
  if (/<button\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:sm|md|lg|xl|2xl):hidden\b/i.test(headerHtml)) {
    return false;
  }
  if (/<nav\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:sm|md|lg|xl|2xl):hidden\b[^"']*["']/i.test(headerHtml)) {
    return false;
  }
  return true;
}

export function shouldInjectStudioAutoMobileNav(bodyInnerHtml: string): boolean {
  if (/data-gentrix-auto-mobile-nav\s*=\s*/i.test(bodyInnerHtml)) return false;

  // Vroege exit: body heeft zowel een nav-key in x-data als een @click die die key bedient.
  // Dit vangt alle patronen op, ook als de knop geen lg:hidden of menu-aria-label heeft.
  for (const key of ALPINE_NAV_TOGGLE_KEYS) {
    if (new RegExp(`\\b${key}\\s*:`).test(bodyInnerHtml)) {
      if (new RegExp(`(?:@click|x-on:click)\\s*=\\s*["'][^"]+\\b${key}\\b`).test(bodyInnerHtml)) {
        return false;
      }
    }
  }

  const win = sliceFirstHeaderHtml(bodyInnerHtml);
  if (!win) {
    const firstSection = sliceFirstSectionHtml(bodyInnerHtml);
    const hasDrawerInSection = headerHasLikelyBrokenMobileDrawer(firstSection);
    if (hasDrawerInSection && !headerHasWiredAlpineMobileMenuToggle(firstSection)) return true;
    return !bodyHasEarlyTopNavWithoutHeaderTag(bodyInnerHtml);
  }
  const hasWiredMobileToggle = headerHasWiredAlpineMobileMenuToggle(bodyInnerHtml);
  if (hasWiredMobileToggle) return false;
  const hasLikelyBrokenDrawer = headerHasLikelyBrokenMobileDrawer(win);
  const hrefCount = (win.match(/<a\b[^>]*\bhref\s*=/gi) ?? []).length;
  if (/\b(fixed|sticky)\b/i.test(win) && hrefCount >= 1 && !hasLikelyBrokenDrawer) {
    if (headerHasDesktopOnlyNavWithoutSmallScreenMenuButton(win)) return true;
    if (headerHasUnwiredMobileMenuButton(win, bodyInnerHtml)) return true;
    if (headerHasAlpineNavOpenSheetWithoutNavToggle(win, bodyInnerHtml)) return true;
    return false;
  }
  return true;
}

export const STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS = `
/* Verberg zijdelingse mobiele drawers van de originele nav op alle schermgroottes
 * (hebben normaal lg:hidden; zonder Alpine-x-show zijn ze anders altijd zichtbaar). */
div.fixed.top-0.right-0,
div[class*="fixed"][class*="top-0"][class*="right-0"],
div[class*="fixed"][class*="right-0"][class*="w-"],
div[class*="fixed"][class*="right-0"][class*="h-full"],
div[class*="fixed"][class*="inset-y-0"][class*="right-0"],
div[class*="fixed"][class*="right-0"][class*="z-"] {
  display: none !important;
}

/* Op mobiel (<1024px): originele headers/navs verbergen — auto-nav neemt het over. */
@media (max-width: 1023px) {
  body > header[${AUTO_NAV_ATTR}] ~ header,
  body > header[${AUTO_NAV_ATTR}] ~ section header,
  body > header:not([${AUTO_NAV_ATTR}]),
  body > nav,
  section header,
  section nav,
  section nav[aria-label*="enu"],
  section nav[aria-label*="Menu"],
  body > header:not([${AUTO_NAV_ATTR}]) nav[aria-label*="enu"],
  body > header:not([${AUTO_NAV_ATTR}]) nav[aria-label*="Menu"] {
    display: none !important;
  }
}

/* Op desktop (≥1024px): fallback — verberg auto-nav als die lg:hidden niet heeft gekregen maar wel
 * een originele header bestaat (bijv. bij oude gecachte pagina's).
 * :has() — Chrome 105+, Safari 15.4+, Firefox 121+. */
@media (min-width: 1024px) {
  body > header[${AUTO_NAV_ATTR}].lg\\:hidden,
  body > header[${AUTO_NAV_ATTR}]:has(~ section header) {
    display: none !important;
  }
}

header[${AUTO_NAV_ATTR}] #gentrix-site-mobile-sheet nav[aria-label="Mobiel menu"],
header[${AUTO_NAV_ATTR}] #gentrix-site-mobile-sheet nav[aria-label="Mobile menu"] {
  display: flex !important;
}

@media (min-width: 1024px) {
  header[${AUTO_NAV_ATTR}] button[class*="lg:hidden"],
  header[${AUTO_NAV_ATTR}] button.lg\\:hidden,
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

export const STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS = `header[data-gentrix-auto-mobile-nav="1"] #gentrix-site-mobile-sheet a:not([class*="bg-white"]) {
  color: rgb(248 250 252) !important;
}
header[data-gentrix-auto-mobile-nav="1"] #gentrix-site-mobile-sheet a[class*="bg-white"] {
  color: rgb(15 23 42) !important;
}`;

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
  return "Website";
}

export type StudioAutoMobileNavBrandOptions = {
  navBrandLabel?: string | null;
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

  return `<header id="gentrix-auto-site-header" ${AUTO_NAV_ATTR} data-studio-skip-nav-tone class="fixed inset-x-0 top-0 z-[80] border-b border-white/10 bg-slate-950/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md" x-data="{ navOpen: false, _il(v){try{var io=/iP/.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform));if(io)document.documentElement.style.cssText=v?'overflow:hidden;position:fixed;width:100%':''}catch(_){}}, init(){this.$watch('navOpen',v=>this._il(v))} }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:gap-4 md:px-6">
    ${brandBlock}
    ${desktopNavBlock}
    <button type="button" class="relative inline-flex h-11 w-11 shrink-0 appearance-none items-center justify-center rounded-xl text-white ring-1 ring-white/15 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 lg:hidden" @click="navOpen = !navOpen" :aria-expanded="navOpen.toString()" aria-controls="gentrix-site-mobile-sheet">
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
  <div class="fixed inset-x-0 bottom-0 top-16 z-[60] bg-slate-950/55 backdrop-blur-sm lg:hidden" x-show="navOpen" x-cloak
    x-transition:enter="transition-opacity duration-[260ms] ease-out"
    x-transition:enter-start="opacity-0"
    x-transition:enter-end="opacity-100"
    x-transition:leave="transition-opacity duration-[220ms] ease-in"
    x-transition:leave-start="opacity-100"
    x-transition:leave-end="opacity-0"
    @click="navOpen = false" aria-hidden="true"></div>
  <div id="gentrix-site-mobile-sheet" class="fixed inset-x-0 top-16 z-[70] overflow-hidden border-t border-white/10 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.6)] ring-1 ring-white/10 lg:hidden will-change-transform" x-show="navOpen" x-cloak
    x-transition:enter="transition-[transform,opacity] duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
    x-transition:enter-start="opacity-0 -translate-y-full"
    x-transition:enter-end="opacity-100 translate-y-0"
    x-transition:leave="transition-[transform,opacity] duration-[260ms] [transition-timing-function:cubic-bezier(0.4,0,0.2,1)]"
    x-transition:leave-start="opacity-100 translate-y-0"
    x-transition:leave-end="opacity-0 -translate-y-full"
    @click.stop>
    <div class="overflow-y-auto max-h-[calc(100svh-4rem)] px-4 pb-8 pt-5">
      ${mobileSheetNavBlock}
    </div>
  </div>
</header>`;
}
