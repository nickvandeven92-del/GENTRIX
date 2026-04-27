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
import type { NavVisualContract, NavVisualPresetId } from "@/lib/site/studio-nav-visual-presets";
import { resolveNavVisualPreset } from "@/lib/site/studio-nav-visual-presets";
import { pickMarkCharForSiteIdentity } from "@/lib/site/site-identity-favicon";

/**
 * Presets waarmee `navBarLayout: linksRightInHero` een zwevende cluster over de hero mag (donker glas i.p.v. vol-breedte-balk).
 * `variant: "pill"`: host staat `fixed` — spacer hoort **nul** te zijn, anders een lege strook (body-achtergrond) vóór de hero.
 */
const HERO_OVERLAY_ELIGIBLE_PRESETS = new Set<NavVisualPresetId>([
  "minimalLight",
  "softBrand",
  "compactBar",
  "glassLight",
  "floatingPill",
]);

function studioNavChromeHeroOverlayEligible(presetId: NavVisualPresetId | null, contract: NavVisualContract): boolean {
  const presetOk =
    presetId != null
      ? HERO_OVERLAY_ELIGIBLE_PRESETS.has(presetId)
      : contract.surface === "light" || contract.surface === "glass";
  if (!presetOk) return false;
  if (contract.variant === "bar") return true;
  /* Zwevende pill: zelfde overlay-pad als bar (fixed top-right cluster, spacer hoogte 0). */
  if (contract.variant === "pill" && presetId === "floatingPill") return true;
  return false;
}

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

function linkIndicatorClasses(ai: NavVisualContract["activeIndicator"], linkRadius: string): string {
  if (ai === "underline")
    return "underline-offset-[6px] decoration-2 decoration-transparent hover:underline hover:decoration-[color:var(--studio-nav-accent)]";
  if (ai === "pill") return `${linkRadius} px-2.5 py-1 hover:bg-[color:var(--studio-nav-hover-bg)]`;
  return "";
}

function spacerClass(contract: NavVisualContract, heroOverlay: boolean): string {
  if (heroOverlay) {
    return "studio-nav-chrome-spacer studio-nav-chrome-spacer--hero-overlay w-full shrink-0 h-0 min-h-0 max-h-0 overflow-hidden border-0 p-0 m-0 pointer-events-none";
  }
  const base = "studio-nav-chrome-spacer w-full shrink-0";
  if (contract.variant === "pill") {
    /* Pill zweeft `fixed` boven de eerste sectie; h-24/h-28 hier = zichtbare “balk” in page-bg vóór de hero. */
    return `${base} h-0 min-h-0 max-h-0 overflow-hidden border-0 p-0 m-0 pointer-events-none`;
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
  const navBarLayout = config.navBarLayout ?? "standard";
  const isHeroOverlay =
    navBarLayout === "linksRightInHero" && studioNavChromeHeroOverlayEligible(presetId, contract);
  const tone = buildStudioNavChromeTone(themeEffectiveForNavChrome(theme ?? undefined, config) ?? null, contract, {
    heroOverlayBar: isHeroOverlay,
  });
  const hostStyle = contract.variant === "pill" ? tone.pillHostStyle : tone.barHostStyle;
  const shadow = tone.hostShadowClass.trim();
  const shadowPart = shadow ? ` ${shadow}` : "";
  /**
   * Host zonder `left-1/2 -translate-x-1/2`. Shell: scherpe hoeken; CTA’s gebruiken `tone.ctaRadiusClass`.
   */
  const pillShellVisual = `rounded-none${shadowPart ? ` ${shadowPart}` : ""}`.trim();
  const usePillFlexCenter = contract.variant === "pill" && !isHeroOverlay;

  /** Mobiel (<md): volle-breedte balk bovenaan (Vugts-patroon); vanaf tablet/desktop zwevende pill/hero-cluster waar van toepassing. */
  const hostClass = isHeroOverlay
    ? `fixed z-50 flex w-full flex-col items-stretch overflow-visible max-md:left-0 max-md:right-0 max-md:top-0 max-md:max-w-none max-md:rounded-none max-md:ring-0 md:right-4 md:top-4 md:left-auto md:w-max md:max-w-[min(100vw-2rem,80rem)] md:rounded-none md:ring-1 md:ring-white/15${shadowPart}`.trim()
    : contract.variant === "pill"
      ? `fixed left-0 right-0 z-50 flex overflow-visible max-md:top-0 max-md:justify-stretch max-md:px-0 max-md:pointer-events-auto md:pointer-events-none md:top-4 md:justify-center md:px-4`.trim()
      : `fixed top-0 left-0 right-0 z-50 w-full overflow-visible ${tone.barBottomRadiusClass}${shadowPart}`.trim();

  const innerPad = innerYClasses(contract);
  const innerWrapClass =
    contract.variant === "pill"
      ? `flex w-full min-w-0 items-center justify-between gap-6 sm:gap-8 md:gap-10 ${innerPad}`
      : isHeroOverlay
        ? `flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 px-4 py-2 sm:gap-3 sm:px-6 sm:py-2.5 md:justify-end md:px-8 ${innerPad}`
        : `mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-6 px-4 sm:gap-8 sm:px-6 md:gap-10 lg:px-8 ${innerPad}`;

  const r = tone.ctaRadiusClass;
  const ind = linkIndicatorClasses(contract.activeIndicator, r);
  const linkDesktop =
    `shrink-0 whitespace-nowrap text-sm font-medium transition-colors text-[color:var(--studio-nav-fg-muted)] hover:text-[color:var(--studio-nav-fg-hover)] ${ind}`.trim();
  const linkMobile =
    `block ${r} px-2 py-2 text-base font-medium text-[color:var(--studio-nav-fg-muted)] transition-colors hover:bg-[color:var(--studio-nav-hover-bg)] hover:text-[color:var(--studio-nav-fg-hover)] ${ind}`.trim();

  const markChar = escapeAttr(pickMarkCharForSiteIdentity(config.brandLabel, config.brandLabel));
  const brandLabelEsc = escapeAttr(config.brandLabel);
  /**
   * Hero-float: geen monogram-postzegel; compact woordmerk links in de pill (sm), mobiel alleen sheet.
   * centeredLinks: brand gewikkeld in flex-1 wrapper zodat de links-cluster echt gecenterd staat
   * t.o.v. de volledige balkbreedte (brand-wrapper en trailing-wrapper zijn beide flex-1).
   */
  const brandLink = isHeroOverlay
    ? `<a href="${escapeAttr(brandHref)}" class="group mr-auto flex min-w-0 max-w-[min(100%,14rem)] shrink-0 items-center text-[color:var(--studio-nav-fg)] hover:text-[color:var(--studio-nav-fg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--studio-nav-accent)]/35 rounded-sm" aria-label="${brandLabelEsc}"><span class="truncate text-sm font-semibold tracking-tight">${brandLabelEsc}</span></a>`
    : `<a href="${escapeAttr(brandHref)}" class="group flex min-w-0 shrink-0 items-center gap-2.5 text-[color:var(--studio-nav-fg)] hover:text-[color:var(--studio-nav-fg-hover)]"><span class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[color:var(--studio-nav-accent)] text-sm font-bold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10" aria-hidden="true">${markChar}</span><span class="truncate text-base font-semibold tracking-tight">${brandLabelEsc}</span></a>`;
  const brand = (navBarLayout === "centeredLinks" && !isHeroOverlay)
    ? `<div class="flex min-w-0 flex-1 shrink-0 items-center justify-start">${brandLink}</div>`
    : brandLink;

  const desktopLinks =
    config.items
      .map(
        (it, i) =>
          `<a href="${escapeAttr(it.href)}" data-analytics="nav-link-${i}" class="${linkDesktop}">${escapeAttr(it.label)}</a>`,
      )
      .join("") +
    (config.cta
      ? `<a href="${escapeAttr(config.cta.href)}" data-analytics="nav-cta" class="${linkDesktop}">${escapeAttr(config.cta.label)}</a>`
      : "");

  const mobileLinks =
    config.items
      .map(
        (it, i) =>
          `<a href="${escapeAttr(it.href)}" data-analytics="nav-link-${i}" class="${linkMobile}">${escapeAttr(it.label)}</a>`,
      )
      .join("") +
    (config.cta
      ? `<a href="${escapeAttr(config.cta.href)}" data-analytics="nav-cta" class="${linkMobile}">${escapeAttr(config.cta.label)}</a>`
      : "");

  const menuBtn = `<button type="button" class="studio-nav-chrome-menu-btn gentrix-menu-repaired inline-flex h-11 w-11 shrink-0 items-center justify-center ${r} text-[color:var(--studio-nav-fg)] hover:bg-[color:var(--studio-nav-hover-bg)] md:hidden" aria-label="Menu" @click.stop="${NAV_KEY} = !${NAV_KEY}" :aria-expanded="${NAV_KEY}.toString()">${buildGentrixMenuIconToggle(NAV_KEY)}</button>`;

  const mobileMenuTriggerRow = isHeroOverlay
    ? `<div class="studio-nav-chrome-mobile-triggers flex shrink-0 items-center gap-2 md:hidden">${menuBtn}</div>`
    : menuBtn;

  const desktopLinksCluster = `<div class="flex flex-nowrap items-center justify-center gap-4 sm:gap-6">${desktopLinks}</div>`;

  const desktopRowStandard = `<div class="hidden min-w-0 flex-nowrap items-center gap-4 sm:gap-6 md:flex">${desktopLinks}</div>`;

  const desktopRowCentered = `<div class="hidden min-w-0 flex-1 justify-center md:flex">${desktopLinksCluster}</div>`;

  const desktopTrailing = `<div class="flex flex-1 justify-end items-center gap-2">${menuBtn}</div>`;

  const desktopRow = isHeroOverlay
    ? `${desktopRowStandard}${mobileMenuTriggerRow}`
    : navBarLayout === "centeredLinks"
      ? `${desktopRowCentered}${desktopTrailing}`
      : `${desktopRowStandard}${menuBtn}`;

  const sheetPT = isHeroOverlay ? "pt-3" : "pt-2";
  /**
   * Mobiel sheet: **`absolute top-full`** onder de `<header>` i.p.v. `fixed` + gegokte `top-*`
   * (padding/hoogte verschilt per preset → anders 1px spleet met hero).
   * `-mt-px`: subpixel tussen balk en sheet. `max-h`: ruim onder viewport-top gereserveerd voor balk + safe area.
   */
  const sheetMaxHExpr = "min(88dvh,calc(100dvh-5rem))";
  const mobileSheetBase = `absolute left-0 right-0 top-full z-[60] -mt-px overflow-y-auto overscroll-contain px-4 pb-5 ${sheetPT} shadow-2xl md:hidden max-h-[${sheetMaxHExpr}]`;
  const mobileSheetClass = isHeroOverlay ? `${mobileSheetBase} ring-1 ring-black/10` : mobileSheetBase;

  const mobileSheetClassFinal = usePillFlexCenter ? `${mobileSheetClass} pointer-events-auto` : mobileSheetClass;

  const mobileSheet = `<div
    id="studio-nav-chrome-mobile-sheet"
    x-show="${NAV_KEY}"
    x-cloak
    @click="if ($event.target.closest('a')) { ${NAV_KEY} = false }"
    x-transition:enter="transition ease-out duration-300 [transition-property:max-height,opacity] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
    x-transition:enter-start="!max-h-0 !opacity-0"
    x-transition:enter-end="!max-h-[${sheetMaxHExpr}] !opacity-100"
    x-transition:leave="transition ease-in duration-220 [transition-property:max-height,opacity]"
    x-transition:leave-start="!max-h-[${sheetMaxHExpr}] !opacity-100"
    x-transition:leave-end="!max-h-0 !opacity-0"
    class="${mobileSheetClassFinal}"
    style="background:var(--studio-nav-sheet-bg, rgba(250,251,253,0.97))"
  >${mobileLinks}</div>`;

  const spacer = spacerClass(contract, isHeroOverlay);
  const presetAttr = presetId ? ` data-studio-nav-preset="${escapeAttr(presetId)}"` : "";
  const layoutAttr = ` data-studio-nav-bar-layout="${escapeAttr(navBarLayout)}"`;
  const heroOverlayAttr = isHeroOverlay ? ` data-studio-nav-hero-overlay="1"` : "";
  const xDataAttr = isHeroOverlay
    ? `x-data="{ ${NAV_KEY}: false, shellScrolled: false }"`
    : `x-data="{ ${NAV_KEY}: false }"`;
  const scrollShellAttr = isHeroOverlay
    ? ` @scroll.window="shellScrolled = ((window.pageYOffset || document.documentElement.scrollTop || 0) > 32)"`
    : "";
  const shellClassAttr = isHeroOverlay ? ` :class="{ 'studio-nav-shell-scrolled': shellScrolled }"` : "";

  /** Pill-inner draagt `hostStyle`; variabelen ook op `<header>` zodat het mobiele sheet (sibling) `var(--studio-nav-sheet-bg)` krijgt. */
  const headerStyleAttr = usePillFlexCenter
    ? ` style="${escapeAttr(tone.chromeScopeStyle)}"`
    : ` style="${escapeAttr(hostStyle)}"`;
  const pillInnerClass = `pointer-events-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-6 sm:gap-8 md:gap-10 px-5 sm:px-7 md:px-11 max-md:max-w-none max-md:rounded-none max-md:shadow-none ${innerPad} ${pillShellVisual}`.trim();
  const innerStyleAttr = usePillFlexCenter ? ` style="${escapeAttr(hostStyle)}"` : "";

  const innerBlock = usePillFlexCenter
    ? `<div class="${pillInnerClass}"${innerStyleAttr}>
    ${brand}
    ${desktopRow}
  </div>`
    : `<div class="${innerWrapClass}">
    ${brand}
    ${desktopRow}
  </div>`;

  return `<header class="${hostClass}"${headerStyleAttr} ${xDataAttr}${scrollShellAttr} @keydown.escape.window="${NAV_KEY} = false" @click.outside="${NAV_KEY} = false"${shellClassAttr} data-studio-nav-chrome="1" data-gentrix-scroll-nav="1" data-gentrix-scrolled="0"${presetAttr}${layoutAttr}${heroOverlayAttr}>
  ${innerBlock}
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
