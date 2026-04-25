/**
 * **Server-side** HTML voor declaratieve primaire nav (`studioNav` + theme).
 * Niet te verwarren met `lib/ai/studio-nav-chrome-pattern-library.ts`: dat is **alleen** prompt-voorbeelden
 * voor legacy-AI-nav; dit bestand rendert echte markup voor preview/export.
 */
import { buildGentrixMenuIconToggle, sliceFirstSiteChromeNavBlock } from "@/lib/ai/generate-site-postprocess";
import type { MasterPromptTheme, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { StudioNavChromeConfig } from "@/lib/site/studio-nav-chrome-schema";
import { studioNavChromeConfigSchema } from "@/lib/site/studio-nav-chrome-schema";
import { buildStudioNavChromeTone } from "@/lib/site/studio-nav-theme";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const NAV_KEY = "navOpen";

/**
 * Verwijdert de eerste site-chrome (`<header>`, `role=banner`, of sticky `<nav>`) uit één HTML-fragment.
 */
export function stripFirstSiteChromeFromSectionHtml(html: string): string {
  const s = sliceFirstSiteChromeNavBlock(html);
  if (!s) return html;
  let rest = html.slice(s.end);
  rest = rest.replace(/^\s*<div\b[^>]*\bstudio-nav-chrome-spacer\b[^>]*>\s*<\/div>\s*/i, "");
  return `${html.slice(0, s.start)}${rest}`;
}

export function parseStudioNavChromeConfig(raw: unknown): StudioNavChromeConfig | null {
  const r = studioNavChromeConfigSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/**
 * Canonieke Tailwind + Alpine chrome voor `config.studioNav`.
 * Kleuren volgen `theme` (primary/accent + licht/donker i.f.m. primary-luminantie); layout blijft `variant` (bar/pill).
 * App-shell: `fixed` bovenaan het viewport + `studio-nav-chrome-spacer` reserveert hoogte zodat pagina-inhoud eronder start.
 * Mobiel: hamburger (3 SVG-lijnen) opent een sheet direct onder de balk met `x-transition`; `@click.outside` klapt dicht.
 * `data-gentrix-scroll-nav` + document-shell voor scroll — geen `@scroll.window` met `>` in attributen.
 */
export function renderStudioNavChromeHtml(config: StudioNavChromeConfig, theme?: MasterPromptTheme | null): string {
  const brandHref = config.brandHref ?? "__STUDIO_SITE_BASE__";
  const tone = buildStudioNavChromeTone(theme ?? null);
  const hostStyle = config.variant === "pill" ? tone.pillHostStyle : tone.barHostStyle;

  const hostClass =
    config.variant === "pill"
      ? `fixed top-4 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 items-center justify-between gap-4 overflow-visible px-4 py-2.5 shadow-lg sm:px-5 sm:gap-6 ${tone.pillRadiusClass}`
      : `fixed top-0 left-0 right-0 z-50 w-full overflow-visible ${tone.barBottomRadiusClass}`.trim();

  const innerWrapClass =
    config.variant === "pill"
      ? "flex w-full min-w-0 items-center justify-between gap-3 sm:gap-6"
      : "mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8 sm:gap-6";

  const linkDesktop =
    "text-sm font-medium transition-colors text-[color:var(--studio-nav-fg-muted)] hover:text-[color:var(--studio-nav-fg-hover)]";
  const linkMobile =
    "block rounded-md px-2 py-2 text-base font-medium text-[color:var(--studio-nav-fg-muted)] transition-colors hover:bg-[color:var(--studio-nav-hover-bg)] hover:text-[color:var(--studio-nav-fg-hover)]";
  const ctaClass =
    "inline-flex shrink-0 items-center rounded-sm border border-[color:var(--studio-nav-accent)] px-3 py-1.5 text-sm font-medium text-[color:var(--studio-nav-accent)] transition-opacity hover:opacity-90";
  const ctaMobileClass =
    "mt-2 block rounded-md border border-[color:var(--studio-nav-accent)] px-3 py-2 text-center text-sm font-medium text-[color:var(--studio-nav-accent)] transition-opacity hover:opacity-90";

  const brand = `<a href="${escapeAttr(brandHref)}" class="shrink-0 text-base font-semibold tracking-tight text-[color:var(--studio-nav-fg)] hover:text-[color:var(--studio-nav-fg-hover)]">${escapeAttr(config.brandLabel)}</a>`;

  const desktopLinks = config.items
    .map((it) => `<a href="${escapeAttr(it.href)}" class="${linkDesktop}">${escapeAttr(it.label)}</a>`)
    .join("");

  const ctaBlock = config.cta
    ? `<a href="${escapeAttr(config.cta.href)}" class="${ctaClass}">${escapeAttr(config.cta.label)}</a>`
    : "";

  const mobileLinks = config.items
    .map((it) => `<a href="${escapeAttr(it.href)}" class="${linkMobile}">${escapeAttr(it.label)}</a>`)
    .join("");

  const mobileCta = config.cta
    ? `<a href="${escapeAttr(config.cta.href)}" class="${ctaMobileClass}">${escapeAttr(config.cta.label)}</a>`
    : "";

  const menuBtn = `<button type="button" class="gentrix-menu-repaired inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[color:var(--studio-nav-fg)] hover:bg-[color:var(--studio-nav-hover-bg)] lg:hidden" aria-label="Menu" @click.stop="${NAV_KEY} = !${NAV_KEY}" :aria-expanded="${NAV_KEY}.toString()">${buildGentrixMenuIconToggle(NAV_KEY)}</button>`;

  const desktopRow = `<div class="hidden min-w-0 flex-wrap items-center gap-6 lg:flex">${desktopLinks}${ctaBlock ? `<span class="hidden sm:inline">${ctaBlock}</span>` : ""}</div>`;

  const mobileSheet = `<div
    id="studio-nav-chrome-mobile-sheet"
    x-show="${NAV_KEY}"
    x-cloak
    @click="if ($event.target.closest('a')) { ${NAV_KEY} = false }"
    x-transition:enter="transition ease-out duration-200 transform"
    x-transition:enter-start="-translate-y-2 opacity-0"
    x-transition:enter-end="translate-y-0 opacity-100"
    x-transition:leave="transition ease-in duration-150 transform"
    x-transition:leave-start="translate-y-0 opacity-100"
    x-transition:leave-end="-translate-y-2 opacity-0"
    class="absolute inset-x-0 top-full z-[60] origin-top px-4 pb-4 pt-1 shadow-lg lg:hidden"
    style="background:var(--studio-nav-sheet-bg);border-top:1px solid var(--studio-nav-sheet-border)"
  >${mobileLinks}${mobileCta}</div>`;

  const spacerClass =
    config.variant === "pill"
      ? "studio-nav-chrome-spacer h-24 w-full shrink-0"
      : "studio-nav-chrome-spacer h-16 w-full shrink-0";

  return `<header class="${hostClass}" style="${hostStyle}" x-data="{ ${NAV_KEY}: false }" @keydown.escape.window="${NAV_KEY} = false" @click.outside="${NAV_KEY} = false" data-studio-nav-chrome="1" data-gentrix-scroll-nav="1" data-gentrix-scrolled="0">
  <div class="${innerWrapClass}">
    ${brand}
    ${desktopRow}
    ${menuBtn}
  </div>
  ${mobileSheet}
</header><div class="${spacerClass}" aria-hidden="true"></div>`;
}

/**
 * Verwijdert AI-chrome uit het eerste fragment dat chrome bevat; plakt declaratieve nav erboven.
 * Zo blijft één `<section>`-wrapper (sticky context) gelijk aan bestaande export.
 */
export function prependStudioNavChromeToFirstSection(
  sections: readonly TailwindSection[],
  navHtml: string,
): TailwindSection[] {
  if (sections.length === 0) return [...sections];
  let chromeIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    if (sliceFirstSiteChromeNavBlock(sections[i]!.html)) {
      chromeIdx = i;
      break;
    }
  }
  if (chromeIdx === -1) {
    const [first, ...rest] = sections;
    return [{ ...first!, html: `${navHtml}\n${first!.html}` }, ...rest];
  }
  const row = sections[chromeIdx]!;
  const stripped = stripFirstSiteChromeFromSectionHtml(row.html);
  const next = [...sections];
  next[chromeIdx] = { ...row, html: `${navHtml}\n${stripped}` };
  return next;
}
