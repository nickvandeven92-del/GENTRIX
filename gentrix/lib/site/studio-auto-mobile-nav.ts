/**
 * Automatische mobiele navigatie (Alpine): standaard **ingeklapt**, alleen op kleine viewports
 * de drie-strepjes-knop; desktop (`lg+`) toont het horizontale menu — geen hamburger op breed scherm.
 */
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_CONTACT_PATH_PLACEHOLDER } from "@/lib/site/studio-section-visibility";

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
  /* Bestaand mobiel menu: knop alleen zichtbaar onder lg, of Alpine-navstate op de header. */
  if (/<button[^>]*class\s*=\s*["'][^"']*\blg:hidden\b/i.test(fromHeader)) return false;
  if (/\bx-data\s*=\s*["'][^"']*navOpen/i.test(fromHeader)) return false;
  return true;
}

/**
 * Verbergt op mobiel een eventuele tweede `<header>` in de eerste sectie (vaak de AI-hero-nav),
 * zodat alleen de automatische balk zichtbaar is.
 */
export const STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS = `@media (max-width: 1023px) {
  body > header[${AUTO_NAV_ATTR}] ~ section:first-of-type header {
    display: none !important;
  }
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
        `<a href="${escapeHtmlText(it.href)}" class="transition hover:text-white">${it.label}</a>`,
    )
    .join("\n      ");

  const mobileLinksHtml = unique
    .map(
      (it) =>
        `<a href="${escapeHtmlText(it.href)}" class="rounded-lg px-3 py-3 hover:bg-white/5" @click="navOpen = false">${it.label}</a>`,
    )
    .join("\n      ");

  const desktopNavBlock =
    unique.length > 0
      ? `<nav class="hidden items-center gap-8 text-sm font-medium text-white/90 lg:flex" aria-label="Hoofdmenu">
      ${linksHtml}
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90">Contact</a>
    </nav>`
      : `<nav class="hidden items-center gap-6 text-sm font-medium text-white/90 lg:flex" aria-label="Hoofdmenu">
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white/90">Contact</a>
    </nav>`;

  const mobileSheetNavBlock =
    unique.length > 0
      ? `<nav class="flex flex-col gap-1 text-base font-medium text-white" aria-label="Mobiel menu">
      ${mobileLinksHtml}
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="mt-2 rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white/90" @click="navOpen = false">Contact</a>
    </nav>`
      : `<nav class="flex flex-col gap-1 text-base font-medium text-white" aria-label="Mobiel menu">
      <a href="${STUDIO_CONTACT_PATH_PLACEHOLDER}" class="rounded-full bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 hover:bg-white/90" @click="navOpen = false">Contact</a>
    </nav>`;

  return `<header id="gentrix-auto-site-header" ${AUTO_NAV_ATTR} class="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-md" x-data="{ navOpen: false }" @keydown.escape.window="navOpen = false">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
    <a href="#top" class="shrink-0 text-lg font-semibold tracking-tight text-white">${brand}</a>
    ${desktopNavBlock}
    <button type="button" class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition hover:bg-white/10 lg:hidden" @click="navOpen = !navOpen" :aria-expanded="navOpen.toString()" aria-controls="gentrix-site-mobile-sheet">
      <span class="sr-only">Menu</span>
      <span x-show="!navOpen" class="flex w-6 flex-col gap-1.5" aria-hidden="true">
        <span class="block h-0.5 rounded-full bg-white"></span>
        <span class="block h-0.5 rounded-full bg-white"></span>
        <span class="block h-0.5 rounded-full bg-white"></span>
      </span>
      <span x-show="navOpen" x-cloak class="text-2xl font-light leading-none text-white" aria-hidden="true">×</span>
    </button>
  </div>
  <div class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm lg:hidden" x-show="navOpen" x-cloak x-transition.opacity @click="navOpen = false"></div>
  <div id="gentrix-site-mobile-sheet" class="fixed inset-x-0 top-16 z-[70] max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/10 bg-slate-950 px-4 py-6 shadow-2xl lg:hidden" x-show="navOpen" x-cloak x-transition>
    ${mobileSheetNavBlock}
  </div>
</header>`;
}
