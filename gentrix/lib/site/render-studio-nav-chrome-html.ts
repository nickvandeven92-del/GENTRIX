/**
 * **Server-side** HTML voor declaratieve primaire nav (`studioNav` + theme).
 * Visueel contract: `resolveNavVisualPreset` (presets + toegestane overrides); legacy `surface` + infer (theme/contract).
 */
import { buildGentrixMenuIconToggle, sliceFirstSiteChromeNavBlock } from "@/lib/ai/generate-site-postprocess";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import type { MasterPromptTheme, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { StudioNavChromeConfig } from "@/lib/site/studio-nav-chrome-schema";
import { studioNavChromeConfigSchema } from "@/lib/site/studio-nav-chrome-schema";
import { buildStudioNavChromeTone } from "@/lib/site/studio-nav-theme";
import type { NavVisualContract } from "@/lib/site/studio-nav-visual-presets";
import { resolveNavVisualPreset } from "@/lib/site/studio-nav-visual-presets";

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

const NAV_KEY = "navOpen";

/** `navChromeTheme` overschrijft alleen kleuren voor de chrome; preset-keuze blijft op basis van het pagina-thema. */
function themeEffectiveForNavChrome(
  theme: MasterPromptTheme | null | undefined,
  config: StudioNavChromeConfig,
): MasterPromptTheme | null | undefined {
  const o = config.navChromeTheme;
  if (!o?.primary && !o?.accent) return theme ?? undefined;
  if (!theme) {
    return {
      primary: o.primary ?? "#0f172a",
      accent: o.accent ?? "#d4a853",
    };
  }
  return {
    ...theme,
    ...(o.primary ? { primary: o.primary } : {}),
    ...(o.accent ? { accent: o.accent } : {}),
  };
}

function innerYClasses(v: NavVisualContract): string {
  if (v.height === "compact") return "py-2 sm:py-2";
  if (v.height === "spacious") return "py-4 sm:py-5";
  return "py-3 sm:py-3";
}

function linkIndicatorClasses(ai: NavVisualContract["activeIndicator"]): string {
  if (ai === "underline")
    return "underline-offset-[6px] decoration-2 decoration-transparent hover:underline hover:decoration-[color:var(--studio-nav-accent)]";
  if (ai === "pill") return "rounded-full px-2.5 py-1 hover:bg-[color:var(--studio-nav-hover-bg)]";
  return "";
}

function ctaDesktopClasses(cta: NavVisualContract["ctaStyle"]): string {
  const base =
    "inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-sm font-medium transition-opacity";
  if (cta === "solid")
    return `${base} border border-transparent bg-[color:var(--studio-nav-accent)] text-white shadow-sm hover:opacity-92`;
  if (cta === "ghost")
    return `${base} border border-transparent text-[color:var(--studio-nav-fg-muted)] hover:bg-[color:var(--studio-nav-hover-bg)] hover:text-[color:var(--studio-nav-fg-hover)]`;
  return `${base} border border-[color:var(--studio-nav-accent)] text-[color:var(--studio-nav-accent)] hover:opacity-90`;
}

function ctaMobileClasses(cta: NavVisualContract["ctaStyle"]): string {
  const base = "mt-2 block rounded-md px-3 py-2 text-center text-sm font-medium transition-opacity";
  if (cta === "solid")
    return `${base} border border-transparent bg-[color:var(--studio-nav-accent)] text-white hover:opacity-92`;
  if (cta === "ghost")
    return `${base} border border-transparent text-[color:var(--studio-nav-fg-muted)] hover:bg-[color:var(--studio-nav-hover-bg)]`;
  return `${base} border border-[color:var(--studio-nav-accent)] text-[color:var(--studio-nav-accent)] hover:opacity-90`;
}

function spacerClass(contract: NavVisualContract): string {
  const base = "studio-nav-chrome-spacer w-full shrink-0";
  if (contract.variant === "pill") {
    return contract.height === "spacious" ? `${base} h-28` : `${base} h-24`;
  }
  if (contract.height === "compact") return `${base} h-14`;
  if (contract.height === "spacious") return `${base} h-20`;
  return `${base} h-16`;
}

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
 * Hybride: `navVisualPreset` + `navVisualOverrides`, anders legacy `variant` + `surface`.
 */
export function renderStudioNavChromeHtml(
  config: StudioNavChromeConfig,
  theme?: MasterPromptTheme | null,
  designContract?: DesignGenerationContract | null,
): string {
  const brandHref = config.brandHref ?? "__STUDIO_SITE_BASE__";
  const { contract, presetId } = resolveNavVisualPreset(config, theme ?? null, designContract ?? null);
  const tone = buildStudioNavChromeTone(themeEffectiveForNavChrome(theme ?? undefined, config) ?? null, contract);
  const hostStyle = contract.variant === "pill" ? tone.pillHostStyle : tone.barHostStyle;
  const shadow = tone.hostShadowClass.trim();
  const shadowPart = shadow ? ` ${shadow}` : "";

  const hostClass =
    contract.variant === "pill"
      ? `fixed top-4 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-5xl -translate-x-1/2 items-center justify-between gap-4 overflow-visible px-4 sm:px-5 sm:gap-6 ${tone.pillRadiusClass}${shadowPart}`.trim()
      : `fixed top-0 left-0 right-0 z-50 w-full overflow-visible ${tone.barBottomRadiusClass}${shadowPart}`.trim();

  const innerPad = innerYClasses(contract);
  const innerWrapClass =
    contract.variant === "pill"
      ? `flex w-full min-w-0 items-center justify-between gap-3 sm:gap-6 ${innerPad}`
      : `mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 sm:gap-6 ${innerPad}`;

  const navBarLayout = config.navBarLayout ?? "standard";

  const ind = linkIndicatorClasses(contract.activeIndicator);
  const linkDesktop =
    `text-sm font-medium transition-colors text-[color:var(--studio-nav-fg-muted)] hover:text-[color:var(--studio-nav-fg-hover)] ${ind}`.trim();
  const linkMobile =
    `block rounded-md px-2 py-2 text-base font-medium text-[color:var(--studio-nav-fg-muted)] transition-colors hover:bg-[color:var(--studio-nav-hover-bg)] hover:text-[color:var(--studio-nav-fg-hover)] ${ind}`.trim();

  const ctaClass = ctaDesktopClasses(contract.ctaStyle);
  const ctaMobileClass = ctaMobileClasses(contract.ctaStyle);

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

  const menuBtn = `<button type="button" class="studio-nav-chrome-menu-btn gentrix-menu-repaired inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[color:var(--studio-nav-fg)] hover:bg-[color:var(--studio-nav-hover-bg)] lg:hidden" aria-label="Menu" @click.stop="${NAV_KEY} = !${NAV_KEY}" :aria-expanded="${NAV_KEY}.toString()">${buildGentrixMenuIconToggle(NAV_KEY)}</button>`;

  const desktopLinksCluster = `<div class="flex flex-wrap items-center justify-center gap-6">${desktopLinks}</div>`;

  const desktopRowStandard = `<div class="hidden min-w-0 flex-wrap items-center gap-6 lg:flex">${desktopLinks}${
    ctaBlock ? `<span class="hidden sm:inline">${ctaBlock}</span>` : ""
  }</div>`;

  const desktopRowCentered = `<div class="hidden min-w-0 flex-1 justify-center lg:flex">${desktopLinksCluster}</div>`;

  const desktopTrailing = `<div class="flex shrink-0 items-center gap-2">${
    navBarLayout === "centeredLinks" && ctaBlock ? `<span class="hidden sm:inline">${ctaBlock}</span>` : ""
  }${menuBtn}</div>`;

  const desktopRow =
    navBarLayout === "centeredLinks"
      ? `${desktopRowCentered}${desktopTrailing}`
      : `${desktopRowStandard}${menuBtn}`;

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

  const spacer = spacerClass(contract);
  const presetAttr = presetId ? ` data-studio-nav-preset="${escapeAttr(presetId)}"` : "";
  const layoutAttr = ` data-studio-nav-bar-layout="${escapeAttr(navBarLayout)}"`;

  return `<header class="${hostClass}" style="${hostStyle}" x-data="{ ${NAV_KEY}: false }" @keydown.escape.window="${NAV_KEY} = false" @click.outside="${NAV_KEY} = false" data-studio-nav-chrome="1" data-gentrix-scroll-nav="1" data-gentrix-scrolled="0"${presetAttr}${layoutAttr}>
  <div class="${innerWrapClass}">
    ${brand}
    ${desktopRow}
  </div>
  ${mobileSheet}
</header><div class="${spacer}" style="${escapeAttr(tone.spacerLayerStyle)}" aria-hidden="true"></div>`;
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
