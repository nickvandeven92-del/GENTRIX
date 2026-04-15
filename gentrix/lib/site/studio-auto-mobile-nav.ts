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
import { STUDIO_CONTACT_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

/**
 * Zelfde sleutels als `fixAlpineNavToggleDefaultsInXData`: als het model al Alpine-navstate in `x-data` zet,
 * geen automatische header injecteren (anders dubbele navbar, vooral op desktop).
 */
const XDATA_HAS_NAV_TOGGLE_RE = new RegExp(
  `\\bx-data\\s*=\\s*["'][^"']*\\b(?:${ALPINE_NAV_TOGGLE_KEYS.join("|")})\\s*:`,
  "i",
);

/** Hamburger / mobiele menuknop: vaak `lg:hidden`, soms alleen `md:hidden` of `xl:hidden`. */
const MOBILE_MENU_BUTTON_HIDDEN_RE =
  /<button[^>]*\bclass\s*=\s*["'][^"']*\b(?:sm|md|lg|xl|2xl):hidden\b/i;

/** Herken onze eigen geïnjecteerde balk (geen dubbele injectie). */
const AUTO_NAV_ATTR = 'data-gentrix-auto-mobile-nav="1"';

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Zelfde normalisatie als `buildStudioSinglePageInternalNavScript` (`slugifyNavKey`) voor `#hash`-links. */
function studioNavHashFromSectionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function shouldInjectStudioAutoMobileNav(bodyInnerHtml: string): boolean {
  if (/data-gentrix-auto-mobile-nav\s*=/i.test(bodyInnerHtml)) return false;
  const idx = bodyInnerHtml.search(/<header\b/i);
  if (idx < 0) return true;
  const fromHeader = bodyInnerHtml.slice(idx, idx + 28_000);
  /* Bestaand mobiel menu: knop verborgen op brede breakpoints, of Alpine-navstate in x-data. */
  if (MOBILE_MENU_BUTTON_HIDDEN_RE.test(fromHeader)) return false;
  if (XDATA_HAS_NAV_TOGGLE_RE.test(fromHeader)) return false;
  return true;
}

/**
 * Verbergt een eventuele tweede `<header>` in de eerste sectie (vaak de AI-hero-nav) zodra de
 * automatische balk is geïnjecteerd — op **alle** breakpoints. Alleen “op mobiel” verbergen gaf
 * dubbele nav + open mobiel paneel in desktop-studio-preview.
 */
export const STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS = `body > header[${AUTO_NAV_ATTR}] ~ section:first-of-type header {
  display: none !important;
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

function defaultBrandLabel(pageConfig: TailwindPageConfig | null | undefined): string {
  if (!pageConfig) return "Website";
  if (isLegacyTailwindPageConfig(pageConfig)) {
    const t = pageConfig.themeName.trim();
    return t.length > 0 ? t.slice(0, 80) : "Website";
  }
  const raw = pageConfig.style.trim().split(/\n+/)[0]?.trim() ?? "";
  if (raw.length > 0) return raw.slice(0, 48);
  return "Website";
}

export function buildStudioAutoMobileNavHeaderHtml(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
): string {
  const brand = escapeHtmlText(defaultBrandLabel(pageConfig ?? null));
  const items = sections
    .map((s) => {
      const hash = studioNavHashFromSectionName(s.sectionName);
      if (!hash) return null;
      const label = escapeHtmlText(s.sectionName.trim().slice(0, 48) || hash);
      return { href: `#${hash}`, label };
    })
    .filter((x): x is { href: string; label: string } => x != null);

  const unique: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
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

  return `<header id="gentrix-auto-site-header" ${AUTO_NAV_ATTR} class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md" x-data="{ navOpen: false }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
    <a href="#top" class="shrink-0 text-lg font-semibold tracking-tight text-white">${brand}</a>
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
