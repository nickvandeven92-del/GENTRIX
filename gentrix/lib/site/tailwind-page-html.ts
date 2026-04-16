/**
 * Server-safe Tailwind-landing HTML (DOMPurify + theme-vars). Gebruikt door iframe-preview en SSR-publieke routes.
 */
import DOMPurify from "isomorphic-dompurify";
import {
  ALPINE_NAV_TOGGLE_KEYS,
  ensureAlpineMobileOverlayHasLgHidden,
  ensureAlpineMobileToggleButtonHasLgHidden,
  fixAlpineNavToggleDefaultsInXData,
  repairBrokenMobileDrawer,
  stripDecorativeScrollCueMarkup,
} from "@/lib/ai/generate-site-postprocess";
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { STUDIO_ALPINE_CDN_SRC } from "@/lib/site/studio-alpine-cdn";
import { STUDIO_LUCIDE_UMD_SRC } from "@/lib/site/studio-lucide-cdn";
import { STUDIO_TAILWIND_PLAY_CDN_SRC } from "@/lib/site/studio-tailwind-cdn";
import { applyBrandLogoFallbackToSections } from "@/lib/site/brand-logo-inject";
import {
  applyStudioPublishedPathPlaceholders,
  neutralizeStudioPathPlaceholdersWithoutSlug,
  stripLeakedStudioPlaceholderTokens,
} from "@/lib/site/studio-section-visibility";
import {
  buildContactSubpageCaptureNavScript,
  type ContactSubpageNavScriptInput,
} from "@/lib/site/tailwind-contact-subpage";
import { STUDIO_PUBLIC_NAV_MESSAGE_SOURCE } from "@/lib/site/studio-public-nav-message";
import { sanitizeCompiledTailwindCssForStyleTag } from "@/lib/site/compiled-tailwind-css-sanitize";
import { rewriteStudioPreviewExternalScripts } from "@/lib/site/studio-preview-lib-registry";
import { buildUserScriptTagForHtmlDocument, sanitizeUserSiteCss } from "@/lib/site/user-site-assets";
import {
  buildStudioAutoMobileNavHeaderHtml,
  extractHeaderNavLinks,
  shouldInjectStudioAutoMobileNav,
  STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS,
  STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS,
  STUDIO_GENERATED_SITE_NAVBAR_CLEANUP_CSS,
} from "@/lib/site/studio-auto-mobile-nav";
import type { GeneratedLogoSet } from "@/types/logo";

export { STUDIO_ALPINE_CDN_SRC } from "@/lib/site/studio-alpine-cdn";
export { STUDIO_LUCIDE_UMD_SRC } from "@/lib/site/studio-lucide-cdn";

/**
 * Tailwind Play CDN staat onderaan de body: zonder guard kan de browser kort ongestyleerde HTML tonen (FOUC).
 * `tw-loading` verbergt de body tot de CDN geladen is; daarna `tw-ready`.
 */
export const STUDIO_TAILWIND_FOUC_HEAD_CSS = `/* FOUC: wacht op Tailwind JIT */
html.tw-loading body { visibility: hidden; }
html.tw-ready body { visibility: visible; }
`;

/**
 * Alpine verbergt `x-cloak`-nodes pas na init; zonder deze regel zijn `x-show`-menu’s en het sluit-icoon
 * kort (of permanent zonder JS) zichtbaar — FOUC en misleidende Lighthouse-filmstrips.
 */
export const STUDIO_ALPINE_X_CLOAK_CSS = `[x-cloak]{display:none!important}`;

/** Klik raakt de BUTTON i.p.v. inner spans (Alpine + sommige browsers). */
export const STUDIO_MOBILE_TOGGLE_POINTER_FIX_CSS = `@media (max-width: 1023px) {
  header button[class*="lg:hidden"] > span,
  header button[class*="md:hidden"] > span,
  header button[class*="sm:hidden"] > span {
    pointer-events: none !important;
  }
}`;

/** [AOS](https://michalsnik.github.io/aos/) v2 — CDN in srcDoc/export (geen npm in gegenereerde pagina). */
export const STUDIO_AOS_CSS_CDN_SRC = "https://unpkg.com/aos@2.3.4/dist/aos.css";
export const STUDIO_AOS_JS_CDN_SRC = "https://unpkg.com/aos@2.3.4/dist/aos.js";

/** Inline boot: draait na `defer` AOS-bundle op DOMContentLoaded (defer-scripts zijn dan geladen). */
const STUDIO_AOS_INLINE_INIT = `(function(){function b(){if(!window.AOS)return;try{AOS.init({duration:720,once:true,offset:20,easing:"ease-out-cubic",disable:window.matchMedia("(prefers-reduced-motion: reduce)").matches});}catch(_){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",b);else b();})();`;

export function getStudioAosHtmlFragments(disabled: boolean): { headLink: string; bodyScripts: string } {
  if (disabled) return { headLink: "", bodyScripts: "" };
  return {
    headLink: `  <link rel="stylesheet" href="${STUDIO_AOS_CSS_CDN_SRC}" crossorigin="anonymous"/>\n`,
    bodyScripts: `<script defer src="${STUDIO_AOS_JS_CDN_SRC}" crossorigin="anonymous"></script>
<script>${STUDIO_AOS_INLINE_INIT}</script>
`,
  };
}

/** [GSAP](https://gsap.com/) 3 — gratis core + veelgebruikte plugins (jsDelivr); geen Club-only bundles. */
const STUDIO_GSAP_VERSION = "3.12.5";
const STUDIO_GSAP_BASE = `https://cdn.jsdelivr.net/npm/gsap@${STUDIO_GSAP_VERSION}/dist`;
export const STUDIO_GSAP_CORE_CDN_SRC = `${STUDIO_GSAP_BASE}/gsap.min.js`;
export const STUDIO_GSAP_SCROLLTRIGGER_CDN_SRC = `${STUDIO_GSAP_BASE}/ScrollTrigger.min.js`;
export const STUDIO_GSAP_FLIP_CDN_SRC = `${STUDIO_GSAP_BASE}/Flip.min.js`;
export const STUDIO_GSAP_MOTIONPATH_CDN_SRC = `${STUDIO_GSAP_BASE}/MotionPathPlugin.min.js`;
export const STUDIO_GSAP_OBSERVER_CDN_SRC = `${STUDIO_GSAP_BASE}/Observer.min.js`;

/** Registreert plugins op `window` na `defer`-load volgorde. */
const STUDIO_GSAP_INLINE_REGISTER = `(function(){function r(){try{var g=window.gsap;if(!g||typeof g.registerPlugin!=="function")return;if(window.ScrollTrigger)g.registerPlugin(window.ScrollTrigger);if(window.Flip)g.registerPlugin(window.Flip);if(window.MotionPathPlugin)g.registerPlugin(window.MotionPathPlugin);if(window.Observer)g.registerPlugin(window.Observer);}catch(_){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",r);else r();})();`;

export function getStudioGsapHtmlFragments(disabled: boolean): { bodyScripts: string } {
  if (disabled) return { bodyScripts: "" };
  return {
    bodyScripts: `<script defer src="${STUDIO_GSAP_CORE_CDN_SRC}" crossorigin="anonymous"></script>
<script defer src="${STUDIO_GSAP_SCROLLTRIGGER_CDN_SRC}" crossorigin="anonymous"></script>
<script defer src="${STUDIO_GSAP_FLIP_CDN_SRC}" crossorigin="anonymous"></script>
<script defer src="${STUDIO_GSAP_MOTIONPATH_CDN_SRC}" crossorigin="anonymous"></script>
<script defer src="${STUDIO_GSAP_OBSERVER_CDN_SRC}" crossorigin="anonymous"></script>
<script>${STUDIO_GSAP_INLINE_REGISTER}</script>
`,
  };
}

/**
 * Veel templates: vaste primary nav `fixed … z-50`, mobiel menu-backdrop `fixed inset-0 z-40`.
 * Dan blijft de balk en hamburger zichtbaar boven het open menu (iframe + smalle viewport).
 * Deze fix verhoogt typische full-screen / full-height menu-lagen op kleine viewports — alleen in srcDoc.
 *
 * **Geen** brede selector `body .fixed.inset-0 { … }`: hero’s gebruiken vaak `fixed inset-0` + gradient/video
 * **zonder** menu-z; `!important` til die dan boven de content → zwarte balk. Alleen bekende overlay-z-lagen.
 *
 * Z-waarden **> 220**: `STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS` zet `header` op 220; lagere z-index liet backdrop
 * en sheet **onder** de header vallen (hamburger/sluit icoon tegelijk, geen collapse).
 *
 * **Geen** `z-10`/`z-20` op alle `inset-0`-lagen: dat tilde willekeurige hero/sectie-overlays naar 260 (“zwarte
 * balk overal”). Alleen `z-30+` op `inset-0` / zijpanelen — **geen** `bg-black`-substring (matcht te vaak
 * hero/sectie-dims in preview). Hero: `revert` zodat hero-gradients niet worden verstoord.
 *
 * Menu-backdrop blijft ≤261; `STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS` zet **header** hoger zodat hamburger/sluit
 * klikbaar blijven (anders vangt de overlay pointer-events boven de balk).
 */
export const STUDIO_MOBILE_MENU_STACKING_FIX_CSS = `@media (max-width: 1023px) {
  body .fixed.inset-0:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.inset-0[class*="z-[30"],
  body .fixed.inset-0[class*="z-[40"],
  body .fixed.inset-0[class*="z-[45"],
  body .fixed.inset-0[class*="z-[50"],
  body .fixed.inset-0[class*="z-[55"],
  body .fixed.inset-0[class*="z-[60"],
  body .fixed.inset-0[class*="z-[70"],
  body .fixed.inset-0[class*="z-[80"],
  body .fixed.inset-0[class*="z-[90"],
  body .fixed.inset-0[class*="z-[100"],
  body .fixed.inset-0[class*="z-[120"] {
    z-index: 260 !important;
  }
  body .fixed.top-0.bottom-0.right-0:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.bottom-0.right-0[class*="z-[5"],
  body .fixed.top-0.bottom-0.right-0[class*="z-[6"],
  body .fixed.top-0.bottom-0.right-0[class*="z-[7"],
  body .fixed.top-0.bottom-0.right-0[class*="z-[8"],
  body .fixed.top-0.bottom-0.left-0:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.bottom-0.left-0[class*="z-[5"],
  body .fixed.top-0.bottom-0.left-0[class*="z-[6"],
  body .fixed.top-0.bottom-0.left-0[class*="z-[7"],
  body .fixed.top-0.bottom-0.left-0[class*="z-[8"],
  body .fixed.top-0.right-0.h-full:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.right-0.h-full[class*="z-[5"],
  body .fixed.top-0.right-0.h-full[class*="z-[6"],
  body .fixed.top-0.right-0.h-full[class*="z-[7"],
  body .fixed.top-0.right-0.h-full[class*="z-[8"],
  body .fixed.top-0.left-0.h-full:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.left-0.h-full[class*="z-[5"],
  body .fixed.top-0.left-0.h-full[class*="z-[6"],
  body .fixed.top-0.left-0.h-full[class*="z-[7"],
  body .fixed.top-0.left-0.h-full[class*="z-[8"],
  body .fixed.top-0.right-0.min-h-screen:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.right-0.min-h-screen[class*="z-[5"],
  body .fixed.top-0.right-0.min-h-screen[class*="z-[6"],
  body .fixed.top-0.right-0.min-h-screen[class*="z-[7"],
  body .fixed.top-0.right-0.min-h-screen[class*="z-[8"],
  body .fixed.top-0.left-0.min-h-screen:is(.z-30,.z-40,.z-50,.z-60),
  body .fixed.top-0.left-0.min-h-screen[class*="z-[5"],
  body .fixed.top-0.left-0.min-h-screen[class*="z-[6"],
  body .fixed.top-0.left-0.min-h-screen[class*="z-[7"],
  body .fixed.top-0.left-0.min-h-screen[class*="z-[8"] {
    z-index: 261 !important;
  }
  body section#hero .fixed.inset-0,
  body #hero .fixed.inset-0 {
    z-index: revert !important;
  }
  body section#hero .fixed.top-0.bottom-0.right-0,
  body section#hero .fixed.top-0.bottom-0.left-0,
  body section#hero .fixed.top-0.right-0.h-full,
  body section#hero .fixed.top-0.left-0.h-full,
  body section#hero .fixed.top-0.right-0.min-h-screen,
  body section#hero .fixed.top-0.left-0.min-h-screen,
  body #hero .fixed.top-0.bottom-0.right-0,
  body #hero .fixed.top-0.bottom-0.left-0,
  body #hero .fixed.top-0.right-0.h-full,
  body #hero .fixed.top-0.left-0.h-full,
  body #hero .fixed.top-0.right-0.min-h-screen,
  body #hero .fixed.top-0.left-0.min-h-screen {
    z-index: revert !important;
  }
}`;

/**
 * Alleen in de HTML-editor bij **Mobiel**-preview (`data-gentrix-studio-mobile` op `<html>`).
 * Veel AI-headers: desktop-`nav` met links blijft `flex` op smalle breedte naast de hamburger.
 * Verberg de eerste directe `nav` onder `header` als er een menuknop (aria-label met “menu”) in de header zit.
 *
 * Alleen binnen `max-width: 1023px`: anders kan (bij zeldzame viewport/resize) de horizontale desktop-nav
 * onterecht verborgen blijven zodra `data-gentrix-studio-mobile` aan staat.
 */
export const STUDIO_MOBILE_EDITOR_FRAME_NAV_CSS = `@media (max-width: 1023px) {
  html[data-gentrix-studio-mobile="1"] header:has(button[aria-label*="enu"]) > nav:first-of-type {
    display: none !important;
  }
  html[data-gentrix-studio-mobile="1"] header:has(button[aria-label*="enu"]) nav[aria-label="Hoofdnavigatie"],
  html[data-gentrix-studio-mobile="1"] header:has(button[aria-label*="enu"]) nav[aria-label="Hoofdmenu"] {
    display: none !important;
  }
}`;

/**
 * iframe-preview: stacking t.o.v. volscherm-menu-backdrops.
 *
 * **Mobiel (≤1023px):** `STUDIO_MOBILE_MENU_STACKING_FIX_CSS` tilt menu-backdrops naar **≤261** binnen
 * dezelfde stacking-context als de balk. De hamburger-knop moet **daarboven** (275) liggen, anders vangt
 * de sibling-overlay alle klikken (“menu doet niets”, icoon blijft hangen).
 *
 * Ook **hele** `header` / `[role="banner"]` / vaste top-balk-`div` op 280 t.o.v. de pagina — veel AI-sites
 * gebruiken geen `<header>`-tag; zonder deze regel blijft backdrop (260) boven een `z-50`-balk.
 *
 * **Desktop (≥1024px) in iframe:** hele header weer boven typische overlays (zeldzamer issue).
 */
export const STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS = `@media (max-width: 1023px) {
  /* Boven STUDIO_MOBILE_MENU_STACKING_FIX (≤261); niet 340 — minder “losse” stacking t.o.v. hero. */
  html[data-gentrix-studio-iframe="1"] header,
  html[data-gentrix-studio-iframe="1"] [role="banner"] {
    z-index: 280 !important;
  }
  /* Div-navbar (geen <header>): eerste vaste top-balk met lg:hidden menuknop — zelfde stacking als header. */
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.sm\\:hidden),
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.md\\:hidden),
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.lg\\:hidden) {
    z-index: 280 !important;
  }
  /*
   * Klikbaar boven backdrop/sheet (≤261): oude z-index:5 was onder de gestackte overlay → taps deden niets.
   */
  html[data-gentrix-studio-iframe="1"] header button[aria-label*="enu"],
  html[data-gentrix-studio-iframe="1"] header button[aria-label*="Menu"],
  html[data-gentrix-studio-iframe="1"] header button[aria-label*="menu"],
  html[data-gentrix-studio-iframe="1"] [role="banner"] button[aria-label*="enu"],
  html[data-gentrix-studio-iframe="1"] [role="banner"] button[aria-label*="Menu"],
  html[data-gentrix-studio-iframe="1"] [role="banner"] button[aria-label*="menu"],
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.sm\\:hidden) button.sm\\:hidden,
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.md\\:hidden) button.md\\:hidden,
  html[data-gentrix-studio-iframe="1"] body > div[class*="fixed"][class*="top-0"]:has(button.lg\\:hidden) button.lg\\:hidden {
    position: relative;
    z-index: 275 !important;
  }
}
@media (min-width: 1024px) {
  html[data-gentrix-studio-iframe="1"] header,
  html[data-gentrix-studio-iframe="1"] [role="banner"] {
    z-index: 340 !important;
  }
}`;

/**
 * Alpine `x-show` zet inline `display`, waardoor Tailwind responsive `*-hidden` op hetzelfde element verliest:
 * mobiele sheet/drawer blijft zichtbaar op desktop terwijl `lg:hidden` / `xl:hidden` bedoeld is om die te verbergen.
 * Alleen binnen `<header>` — voorkomt dat het mobiele menu op breed scherm “open” blijft staan.
 */
export const STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS = `@media (min-width: 640px) {
  html[data-gentrix-studio-iframe="1"] .sm\\:hidden {
    display: none !important;
  }
}
@media (min-width: 768px) {
  html[data-gentrix-studio-iframe="1"] .md\\:hidden {
    display: none !important;
  }
}
@media (min-width: 1024px) {
  html[data-gentrix-studio-iframe="1"] .lg\\:hidden,
  html[data-gentrix-studio-iframe="1"] .xl\\:hidden {
    display: none !important;
  }
  /*
   * Alpine \`x-show\` wint soms van \`lg:hidden\` op een ander element dan waar de utility zit;
   * expliciet het mobiele menu verbergen op desktop-preview (≥1024 in iframe).
   */
  html[data-gentrix-studio-iframe="1"] nav[aria-label="Mobiel menu"],
  html[data-gentrix-studio-iframe="1"] nav[aria-label="Mobile menu"],
  html[data-gentrix-studio-iframe="1"] div[aria-label="Mobiel menu"],
  html[data-gentrix-studio-iframe="1"] div[aria-label="Mobile menu"] {
    display: none !important;
  }
  html[data-gentrix-studio-iframe="1"] body > div.pointer-events-auto:has(nav[aria-label="Mobiel menu"]),
  html[data-gentrix-studio-iframe="1"] body > div.pointer-events-auto:has(nav[aria-label="Mobile menu"]),
  html[data-gentrix-studio-iframe="1"] body > div.pointer-events-auto:has(div[aria-label="Mobiel menu"]),
  html[data-gentrix-studio-iframe="1"] body > div.pointer-events-auto:has(div[aria-label="Mobile menu"]) {
    display: none !important;
  }
  /*
   * Veel AI-headers: sheet/backdrop als direct kind van header met lg:hidden — x-show inline wint anders
   * van losse utility-regels; expliciet verbergen op desktop-preview.
   */
  html[data-gentrix-studio-iframe="1"] header > div[class*="fixed"][class*="inset"][class*="lg:hidden"],
  html[data-gentrix-studio-iframe="1"] header > aside[class*="fixed"][class*="lg:hidden"],
  html[data-gentrix-studio-iframe="1"] [role="banner"] > div[class*="fixed"][class*="inset"][class*="lg:hidden"],
  html[data-gentrix-studio-iframe="1"] [role="banner"] > aside[class*="fixed"][class*="lg:hidden"] {
    display: none !important;
  }
  /*
   * Sheet vaak sibling van header naast section.w-full (niet header > div) — zelfde x-show/inline-issue.
   * Geen backticks in deze comment: staat in een TS-template-string.
   */
  html[data-gentrix-studio-iframe="1"] section.w-full > div[class*="fixed"][class*="lg:hidden"],
  html[data-gentrix-studio-iframe="1"] section.w-full > aside[class*="fixed"][class*="lg:hidden"],
  html[data-gentrix-studio-iframe="1"] section[class*="w-full"] > div[class*="fixed"][class*="inset"][class*="lg:hidden"] {
    display: none !important;
  }
}
@media (min-width: 1280px) {
  html[data-gentrix-studio-iframe="1"] .xl\\:hidden {
    display: none !important;
  }
}`;

export const STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS = `@media (min-width: 1024px) {
  .lg\\:hidden,
  .xl\\:hidden {
    display: none !important;
  }
}`;

/**
 * Alleen **mobiele** HTML-editor-preview (`data-gentrix-studio-mobile` + iframe): vaak halftransparante
 * `nav` / kolom over de hero — leesbaarheid + duidelijke “sheet” zonder live `/site` te wijzigen.
 */
/**
 * Alleen **mobiele** HTML-editor-preview (`data-gentrix-studio-mobile` + iframe): vaak halftransparante
 * `nav` / kolom over de hero — leesbaarheid + duidelijke “sheet” zonder live `/site` te wijzigen.
 */
export const STUDIO_IFRAME_MOBILE_EDITOR_NAV_SHEET_CSS = `@media (max-width: 1023px) {
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header nav,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header [role="navigation"] {
    background-color: rgb(15 23 42 / 0.94) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="fixed"].flex-col,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="absolute"].flex-col,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="inset-0"].flex {
    background-color: rgb(15 23 42 / 0.94) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  /* Mobiel menu: expliciet licht op donker (body heeft text-slate-900; links verdwijnen anders). */
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header nav[aria-label="Mobiel menu"] a:not([class*="bg-white"]) {
    color: rgb(248 250 252) !important;
  }
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header nav[aria-label="Mobiel menu"] a[class*="bg-white"] {
    color: rgb(15 23 42) !important;
  }
}`;

/**
 * Na Alpine init: nav-toggles die per ongeluk op `true` starten → `false`. Veel templates zetten `x-data` op
 * een wrapper **rond** header+menu **of** op een kind **in** `<header>`; beide moeten mee (anders blijft
 * `open: true` uit een factory ongezien en reageert het menu niet).
 *
 * Eerste ronde (**aggressive**): alle booleans `true` waarvan de sleutel op een mobiele nav lijkt — vangt
 * `sidebarMenuOpen`, `x-data="initNav"` i.c.m. factory-keys buiten `ALPINE_NAV_TOGGLE_KEYS`, enz.
 * Latere rondes: alleen nog als het `x-data`-attribuut letterlijk `key: true` bevat (gebruiker mag menu open houden).
 */
export function buildStudioHeaderNavAlpineClampScript(): string {
  const keysLiteral = ALPINE_NAV_TOGGLE_KEYS.map((k) => JSON.stringify(k)).join(",");
  return `<script defer>
(function(){
  var KEYS=[${keysLiteral}];
  var KEY_IDX={};
  for(var kj=0;kj<KEYS.length;kj++)KEY_IDX[KEYS[kj]]=1;
  function readScope(el){
    try{
      if(window.Alpine&&typeof window.Alpine.$data==="function")return window.Alpine.$data(el);
    }catch(_){}
    return el._x_dataStack&&el._x_dataStack[0];
  }
  function isHeaderNavScope(el){
    if(el.closest("footer"))return false;
    return el.tagName==="HEADER"
      ||(el.querySelector&&el.querySelector("header"))
      ||(el.closest&&el.closest("header"));
  }
  function extraNavBoolKey(k){
    if(typeof k!=="string"||k.length>64)return false;
    if(KEY_IDX[k])return true;
    if(k==="open")return true;
    if(/^is(Open|MenuOpen|NavOpen|DrawerOpen)$/i.test(k))return true;
    if(!/Open$/i.test(k))return false;
    var kl=k.toLowerCase();
    return kl.indexOf("menu")>=0||kl.indexOf("nav")>=0||kl.indexOf("drawer")>=0||kl.indexOf("sheet")>=0
      ||kl.indexOf("sidebar")>=0||kl.indexOf("panel")>=0||kl.indexOf("overlay")>=0||kl.indexOf("burger")>=0
      ||kl.indexOf("flyout")>=0||kl.indexOf("offcanvas")>=0||kl.indexOf("mobile")>=0||kl.indexOf("hamb")>=0;
  }
  function clampScopeData(aggressive,raw,d){
    if(!d)return;
    var i,k,re;
    if(aggressive===true){
      for(k in d){
        if(!Object.prototype.hasOwnProperty.call(d,k))continue;
        if(d[k]!==true)continue;
        if(!extraNavBoolKey(k))continue;
        d[k]=false;
      }
      return;
    }
    if(typeof raw!=="string"||!raw.trim())return;
    for(i=0;i<KEYS.length;i++){
      k=KEYS[i];
      if(!Object.prototype.hasOwnProperty.call(d,k)||d[k]!==true)continue;
      re=new RegExp("\\\\b"+k+"\\\\s*:\\\\s*true\\\\b");
      if(re.test(raw))d[k]=false;
    }
  }
  function clampOnce(aggressive){
    try{
      document.querySelectorAll("[x-data]").forEach(function(el){
        if(!isHeaderNavScope(el))return;
        var raw=el.getAttribute("x-data");
        if(raw!=null&&typeof raw==="string"&&!raw.trim())return;
        var d=readScope(el);
        clampScopeData(aggressive,raw,d);
      });
    }catch(_){}
  }
  function closeNavMenusFromEscape(){
    try{
      document.querySelectorAll("[x-data]").forEach(function(el){
        if(!isHeaderNavScope(el))return;
        var d=readScope(el);
        if(!d)return;
        var i,k;
        for(i=0;i<KEYS.length;i++){
          k=KEYS[i];
          if(Object.prototype.hasOwnProperty.call(d,k)&&d[k]===true)d[k]=false;
        }
        for(k in d){
          if(!Object.prototype.hasOwnProperty.call(d,k))continue;
          if(d[k]!==true)continue;
          if(!extraNavBoolKey(k))continue;
          d[k]=false;
        }
      });
    }catch(_){}
  }
  function run(){
    clampOnce(true);
    setTimeout(function(){clampOnce(false);},60);
    setTimeout(function(){clampOnce(false);},200);
    setTimeout(function(){clampOnce(false);},400);
    setTimeout(function(){clampOnce(false);},700);
    /* Geen aggressive meer op 1200ms: dat zette een door de gebruiker geopend menu weer op false. */
    setTimeout(function(){clampOnce(false);},1200);
  }
  function runAfterLoad(){
    clampOnce(true);
    clampOnce(false);
    setTimeout(function(){clampOnce(false);},40);
  }
  document.addEventListener("keydown",function(e){
    if(e.key!=="Escape")return;
    closeNavMenusFromEscape();
  });
  try{window.__gentrixNavClamp=clampOnce;}catch(_){}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);
  else run();
  window.addEventListener("load",runAfterLoad);
})();
</script>`;
}

/**
 * CSS voor `data-animation` (fade-up, slide-in-*, scale-in).
 * Onder de vouw: **CSS transitions** i.p.v. `animation-play-state: paused` + keyframes — die combinatie laat
 * content op keyframe 0% (opacity:0) hangen als IntersectionObserver in een iframe traag uitblijft, waardoor
 * sites “niet bewegen” of leeg lijken. `.studio-in-view` triggert de transitie; fallback-script zet die klasse
 * alsnog na timeout.
 * Hero + eerste secties: **keyframes** blijven voor een duidelijke load-animatie (zelfde timing als vroeger).
 */
export const STUDIO_DATA_ANIMATION_CSS = `@media (prefers-reduced-motion: no-preference) {
  [data-animation="fade-up"] {
    opacity: 0;
    transform: translateY(28px);
    transition: opacity 0.9s cubic-bezier(0.22,1,0.36,1), transform 0.9s cubic-bezier(0.22,1,0.36,1);
    transition-delay: var(--studio-stagger, 0ms);
  }
  [data-animation="fade-up"].studio-in-view {
    opacity: 1;
    transform: none;
  }
  [data-animation="fade-in"] {
    opacity: 0;
    transition: opacity 0.85s cubic-bezier(0.22,1,0.36,1);
    transition-delay: var(--studio-stagger, 0ms);
  }
  [data-animation="fade-in"].studio-in-view {
    opacity: 1;
  }
  [data-animation="slide-in-left"] {
    opacity: 0;
    transform: translateX(-32px);
    transition: opacity 0.85s cubic-bezier(0.22,1,0.36,1), transform 0.85s cubic-bezier(0.22,1,0.36,1);
    transition-delay: var(--studio-stagger, 0ms);
  }
  [data-animation="slide-in-left"].studio-in-view {
    opacity: 1;
    transform: none;
  }
  [data-animation="slide-in-right"] {
    opacity: 0;
    transform: translateX(32px);
    transition: opacity 0.85s cubic-bezier(0.22,1,0.36,1), transform 0.85s cubic-bezier(0.22,1,0.36,1);
    transition-delay: var(--studio-stagger, 0ms);
  }
  [data-animation="slide-in-right"].studio-in-view {
    opacity: 1;
    transform: none;
  }
  [data-animation="scale-in"] {
    opacity: 0;
    transform: scale(0.92);
    transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1);
    transition-delay: var(--studio-stagger, 0ms);
  }
  [data-animation="scale-in"].studio-in-view {
    opacity: 1;
    transform: none;
  }
  /* Boven de vouw: keyframes lopen direct (geen afhankelijkheid van IO in iframe). */
  section#hero [data-animation="fade-up"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="fade-up"] {
    animation: studio-fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  section#hero [data-animation="fade-in"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="fade-in"] {
    animation: studio-fade-in 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  section#hero [data-animation="slide-in-left"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="slide-in-left"] {
    animation: studio-slide-left 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  section#hero [data-animation="slide-in-right"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="slide-in-right"] {
    animation: studio-slide-right 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  section#hero [data-animation="scale-in"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="scale-in"] {
    animation: studio-scale-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  #hero [data-animation="fade-up"] {
    animation: studio-fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  #hero [data-animation="fade-in"] {
    animation: studio-fade-in 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  #hero [data-animation="slide-in-left"] {
    animation: studio-slide-left 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  #hero [data-animation="slide-in-right"] {
    animation: studio-slide-right 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
  #hero [data-animation="scale-in"] {
    animation: studio-scale-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    transition: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-animation] {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
@keyframes studio-fade-up { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
@keyframes studio-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes studio-slide-left { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: none; } }
@keyframes studio-slide-right { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }
@keyframes studio-scale-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }`;

/**
 * Nood-CSS als `disableScrollRevealAnimations` expliciet aan staat: geen paused keyframes / IO.
 * Normale weergave: STUDIO_DATA_ANIMATION_CSS + STUDIO_BORDER_REVEAL_CSS + STUDIO_MARQUEE_CSS + STUDIO_LASER_LINE_CSS
 * + STUDIO_SCROLL_REVEAL_SCRIPT + STUDIO_NAV_SCROLL_CONTRAST_* (sticky nav op lichte achtergrond).
 */
export const STUDIO_DATA_ANIMATION_DISABLED_CSS = `/* Geen scroll-reveal: inhoud met data-animation direct zichtbaar */
[data-animation] {
  animation: none !important;
  transition: none !important;
  opacity: 1 !important;
  transform: none !important;
}`;

/**
 * Lijnaccent dat **uitbreidt** wanneer `.studio-in-view` wordt gezet (zelfde IntersectionObserver als `data-animation`).
 * Lovable-achtig: start ~72% breedte/hoogte, loopt naar 100% bij binnen-scrollen — **geen** losse `<script>` in secties.
 *
 * Markup (horizontaal onder kop): lege container `class="… studio-border-reveal studio-border-reveal--h …"` (min. `h-1` of `mt-6`).
 * Kleur: zet op dezelfde node bv. `[--studio-br-rgb:212_175_55]` (goud) of laat default amber; `::after` gebruikt `rgb(var(--studio-br-rgb) / var(--studio-br-a, 0.92))`.
 * Verticaal: `studio-border-reveal studio-border-reveal--v` + `min-h-[…]` op de wrapper.
 */
export const STUDIO_BORDER_REVEAL_CSS = `@media (prefers-reduced-motion: no-preference) {
  .studio-border-reveal {
    pointer-events: none;
    position: relative;
    flex-shrink: 0;
  }
  .studio-border-reveal--h {
    height: 3px;
  }
  .studio-border-reveal--h::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 100%;
    height: 2px;
    border-radius: 9999px;
    background: rgb(var(--studio-br-rgb, 245 158 11) / var(--studio-br-a, 0.9));
    box-shadow: 0 0 12px rgb(var(--studio-br-rgb, 245 158 11) / 0.25);
    transform: translateX(-50%) scaleX(0.72);
    transform-origin: center;
    transition: transform 0.95s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .studio-border-reveal--h.studio-in-view::after {
    transform: translateX(-50%) scaleX(1);
  }
  .studio-border-reveal--v {
    width: 3px;
    min-height: 3.5rem;
  }
  .studio-border-reveal--v::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    width: 2px;
    height: 100%;
    border-radius: 9999px;
    background: rgb(var(--studio-br-rgb, 245 158 11) / var(--studio-br-a, 0.9));
    box-shadow: 0 0 10px rgb(var(--studio-br-rgb, 245 158 11) / 0.22);
    transform: translateX(-50%) scaleY(0.72);
    transform-origin: center top;
    transition: transform 0.95s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .studio-border-reveal--v.studio-in-view::after {
    transform: translateX(-50%) scaleY(1);
  }
  /* Eerste scherm: zelfde vrijstelling als data-animation — geen “half” lijnwerk boven de vouw */
  section#hero .studio-border-reveal--h::after,
  #hero .studio-border-reveal--h::after,
  body > section.w-full:nth-of-type(-n+3) .studio-border-reveal--h::after {
    transform: translateX(-50%) scaleX(1);
  }
  section#hero .studio-border-reveal--v::after,
  #hero .studio-border-reveal--v::after,
  body > section.w-full:nth-of-type(-n+3) .studio-border-reveal--v::after {
    transform: translateX(-50%) scaleY(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .studio-border-reveal--h::after,
  .studio-border-reveal--v::after {
    transition: none !important;
    transform: translateX(-50%) scaleX(1) !important;
  }
  .studio-border-reveal--v::after {
    transform: translateX(-50%) scaleY(1) !important;
  }
}`;

/** Bij uitgeschakelde scroll-reveal: lijnen direct volledig (geen IO). */
export const STUDIO_BORDER_REVEAL_DISABLED_CSS = `
.studio-border-reveal--h::after {
  transition: none !important;
  transform: translateX(-50%) scaleX(1) !important;
}
.studio-border-reveal--v::after {
  transition: none !important;
  transform: translateX(-50%) scaleY(1) !important;
}`;

/**
 * Horizontale marquee/ticker (vergelijkbaar met Lovable `MarqueeStrip`): pure CSS.
 * Markup: buitenste `div.studio-marquee` + binnen `div.studio-marquee-track` met **twee identieke**
 * blokken inhoud achter elkaar (zelfde logo's/teksten dubbel), zodat `translateX(-50%)` naadloos loopt.
 * Snelheid: optioneel class `studio-marquee--slow` / `studio-marquee--fast` op de track.
 */
export const STUDIO_MARQUEE_CSS = `@media (prefers-reduced-motion: no-preference) {
  .studio-marquee {
    overflow-x: hidden;
    width: 100%;
    -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
    mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
  }
  .studio-marquee-track {
    display: flex;
    width: max-content;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--studio-marquee-gap, 2.5rem);
    animation: studio-marquee-scroll var(--studio-marquee-duration, 38s) linear infinite;
  }
  .studio-marquee-track.studio-marquee--slow {
    --studio-marquee-duration: 55s;
  }
  .studio-marquee-track.studio-marquee--fast {
    --studio-marquee-duration: 22s;
  }
  @keyframes studio-marquee-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }
}
@media (prefers-reduced-motion: reduce) {
  .studio-marquee { -webkit-mask-image: none; mask-image: none; overflow-x: auto; }
  .studio-marquee-track {
    animation: none !important;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    max-width: 100%;
  }
}`;

/**
 * Bewegende “laser” / scan-lijn: pure CSS, geen JS. **Alleen** gebruiken als de briefing expliciet cyber/neon/sci-fi vraagt — niet standaard op elke site.
 *
 * Markup (horizontaal, bovenin hero): `div.studio-laser-h` met `absolute inset-x-0 top-0 z-20` binnen `relative` parent.
 * Varianten: `studio-laser-h--magenta` / `studio-laser-h--neon`, `studio-laser-h--slow` / `--fast`.
 * Verticaal: `div.studio-laser-v` met vaste breedte + hoogte (`h-full min-h-[12rem]`).
 */
export const STUDIO_LASER_LINE_CSS = `@media (prefers-reduced-motion: no-preference) {
  .studio-laser-h {
    --studio-laser-rgb: 34 211 238;
    position: relative;
    overflow: hidden;
    height: 2px;
    pointer-events: none;
  }
  .studio-laser-h::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 38%;
    background: linear-gradient(90deg, transparent, rgb(var(--studio-laser-rgb) / 0.92), transparent);
    box-shadow: 0 0 18px 4px rgb(var(--studio-laser-rgb) / 0.45);
    animation: studio-laser-sweep-x var(--studio-laser-duration, 3.8s) ease-in-out infinite;
  }
  .studio-laser-h--slow {
    --studio-laser-duration: 6.5s;
  }
  .studio-laser-h--fast {
    --studio-laser-duration: 2.6s;
  }
  .studio-laser-h--magenta {
    --studio-laser-rgb: 232 121 249;
  }
  .studio-laser-h--neon::after {
    background: linear-gradient(
      90deg,
      transparent,
      rgb(34 211 238 / 0.9),
      rgb(217 70 239 / 0.85),
      transparent
    );
    box-shadow:
      0 0 16px 3px rgb(34 211 238 / 0.4),
      0 0 10px 2px rgb(217 70 239 / 0.3);
  }
  .studio-laser-v {
    --studio-laser-rgb: 34 211 238;
    position: relative;
    overflow: hidden;
    width: 2px;
    pointer-events: none;
  }
  .studio-laser-v::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 35%;
    background: linear-gradient(180deg, transparent, rgb(var(--studio-laser-rgb) / 0.9), transparent);
    box-shadow: 0 0 14px 3px rgb(var(--studio-laser-rgb) / 0.4);
    animation: studio-laser-sweep-y var(--studio-laser-duration-v, 4.2s) ease-in-out infinite;
  }
  .studio-laser-v--magenta {
    --studio-laser-rgb: 232 121 249;
  }
  .studio-laser-v--slow {
    --studio-laser-duration-v: 6.8s;
  }
}
@media (prefers-reduced-motion: reduce) {
  .studio-laser-h::after,
  .studio-laser-v::after {
    animation: none !important;
    opacity: 0.35;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
  }
  .studio-laser-v::after {
    left: 0;
    right: 0;
    top: 40%;
    height: 20%;
    transform: none;
  }
}
@keyframes studio-laser-sweep-x {
  0% { transform: translateX(-105%); }
  100% { transform: translateX(320%); }
}
@keyframes studio-laser-sweep-y {
  0% { transform: translateY(-110%); }
  100% { transform: translateY(380%); }
}`;

/** Zet `.studio-in-view` op `[data-animation]` en `.studio-border-reveal` wanneer het element in (of net boven) de viewport komt; stagger alleen voor `data-animation`. */
export const STUDIO_SCROLL_REVEAL_SCRIPT = `<script>
(function(){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  function staggerKey(el){
    var s=el.closest("section[id]");
    if(s&&s.id)return s.id;
    s=el.closest("section");
    return s?s.outerHTML.slice(0,80):"__root";
  }
  function boot(){
    var nodes=document.querySelectorAll("[data-animation]");
    var borders=document.querySelectorAll(".studio-border-reveal");
    if(!nodes.length&&!borders.length)return;
    var counts={};
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i];
      var k=staggerKey(el);
      counts[k]=(counts[k]||0)+1;
      var idx=(counts[k]-1);
      el.style.setProperty("--studio-stagger",(idx*100)+"ms");
    }
    var io=new IntersectionObserver(function(ents){
      for(var j=0;j<ents.length;j++){
        var e=ents[j];
        if(!e.isIntersecting)continue;
        e.target.classList.add("studio-in-view");
        io.unobserve(e.target);
      }
    },{root:null,rootMargin:"0px 0px 22% 0px",threshold:0.01});
    for(var n=0;n<nodes.length;n++)io.observe(nodes[n]);
    for(var b=0;b<borders.length;b++)io.observe(borders[b]);
    /* IO in iframe/preview soms laat of nooit: transitie + fallback voorkomen eeuwig verborgen blokken */
    setTimeout(function(){
      var p=document.querySelectorAll("[data-animation]:not(.studio-in-view)");
      for(var k=0;k<p.length;k++)p[k].classList.add("studio-in-view");
      var q=document.querySelectorAll(".studio-border-reveal:not(.studio-in-view)");
      for(var m=0;m<q.length;m++)q[m].classList.add("studio-in-view");
    },1600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
</script>`;

/**
 * Sticky/fixed top-nav: bemonster wat visueel **achter** de balk ligt; bij lichte achtergrond
 * `.studio-nav-tone-light` voor donkere voorgrond (studio-preview + live site + export).
 */
export const STUDIO_NAV_SCROLL_CONTRAST_CSS = `/* Zie STUDIO_NAV_SCROLL_CONTRAST_SCRIPT */
header.studio-nav-tone-light,
nav.studio-nav-tone-light {
  --studio-nav-auto-fg: rgb(15 23 42);
  --studio-nav-auto-muted: rgb(51 65 85);
}
header.studio-nav-tone-light,
header.studio-nav-tone-light a,
header.studio-nav-tone-light button,
header.studio-nav-tone-light span,
header.studio-nav-tone-light li,
header.studio-nav-tone-light label,
header.studio-nav-tone-light svg,
nav.studio-nav-tone-light,
nav.studio-nav-tone-light a,
nav.studio-nav-tone-light button,
nav.studio-nav-tone-light span,
nav.studio-nav-tone-light li,
nav.studio-nav-tone-light label,
nav.studio-nav-tone-light svg {
  color: var(--studio-nav-auto-fg) !important;
}
header.studio-nav-tone-light svg,
nav.studio-nav-tone-light svg {
  fill: currentColor !important;
  stroke: currentColor !important;
}
header.studio-nav-tone-light [class*="border-white"],
nav.studio-nav-tone-light [class*="border-white"] {
  border-color: rgba(15, 23, 42, 0.22) !important;
}
`;

export const STUDIO_NAV_SCROLL_CONTRAST_SCRIPT = `<script>
(function(){
  function lin(c){return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function relLum(r,g,b){return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);}
  function lumFromRgbStr(rgb){
    var m=rgb.match(/rgba?\(([^)]+)\)/);
    if(!m)return null;
    var p=m[1].split(","),r=parseFloat(p[0])/255,g=parseFloat(p[1])/255,b=parseFloat(p[2])/255;
    var a=p.length>3?parseFloat(p[3].trim()):1;
    if(isNaN(r)||isNaN(g)||isNaN(b))return null;
    if(isNaN(a))a=1;
    if(a<0.04)return null;
    var L=relLum(r,g,b);
    return a>=0.9?L:L*a+1*(1-a);
  }
  function bgLum(el){
    var cur=el;
    for(var d=0;d<16&&cur;d++){
      var col=getComputedStyle(cur).backgroundColor;
      var L=lumFromRgbStr(col);
      if(L!=null)return L;
      cur=cur.parentElement;
    }
    return 1;
  }
  function behindNav(nav,x,y){
    var stack=document.elementsFromPoint(x,y);
    for(var i=0;i<stack.length;i++){
      var el=stack[i];
      if(nav.contains(el))continue;
      return bgLum(el);
    }
    return 1;
  }
  function pickNav(){
    var list=document.querySelectorAll("header,nav");
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(el.closest("[data-studio-skip-nav-tone]"))continue;
      if(el.getAttribute&&el.getAttribute("data-gentrix-auto-mobile-nav")==="1")continue;
      var st=getComputedStyle(el);
      if(st.position!=="fixed"&&st.position!=="sticky")continue;
      var r=el.getBoundingClientRect();
      if(r.top>innerHeight*0.42)continue;
      if(r.height>innerHeight*0.55)continue;
      return el;
    }
    return null;
  }
  var nav=null,ticking=false,THRESH=0.57;
  function sync(){
    if(!nav)return;
    var r=nav.getBoundingClientRect();
    if(r.height<20||r.width<32)return;
    var x1=Math.min(Math.max(innerWidth*0.22,6),innerWidth-6);
    var x2=Math.min(Math.max(innerWidth*0.5,6),innerWidth-6);
    var x3=Math.min(Math.max(innerWidth*0.78,6),innerWidth-6);
    var py=Math.min(Math.max(r.top+r.height*0.5,2),innerHeight-3);
    var L=Math.max(behindNav(nav,x1,py),behindNav(nav,x2,py),behindNav(nav,x3,py));
    nav.classList.toggle("studio-nav-tone-light",L>THRESH);
  }
  function onTick(){
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      sync();
    });
  }
  function boot(){
    nav=pickNav();
    if(!nav)return;
    sync();
    addEventListener("scroll",onTick,{passive:true});
    addEventListener("resize",onTick,{passive:true});
    setTimeout(sync,60);
    setTimeout(sync,320);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
</script>`;

export function buildLucideRuntimeScriptBlock(): string {
  return `<script src="${STUDIO_LUCIDE_UMD_SRC}"></script>
<script>try{typeof lucide!=="undefined"&&lucide.createIcons();}catch(e){}</script>`;
}

/** Na Alpine (x-show/x-for): iconen opnieuw initialiseren zodat `@click` op knoppen niet “verdwijnt”. */
export function buildLucidePostAlpineRescanScript(): string {
  return `<script defer>
(function(){
  function tick(){
    try{if(typeof lucide!=="undefined"&&lucide.createIcons)lucide.createIcons();}catch(_){}
  }
  function run(){
    tick();
    setTimeout(tick,40);
    setTimeout(tick,200);
    setTimeout(tick,600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);
  else run();
})();
</script>`;
}

let alpineDomPurifyHookRegistered = false;

function ensureAlpineDomPurifyHook(): void {
  if (alpineDomPurifyHookRegistered) return;
  alpineDomPurifyHookRegistered = true;
  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    const name = data.attrName;
    if (name === "x-html") {
      data.keepAttr = false;
      return;
    }
    if (name.startsWith("x-") || name.startsWith("@") || name.startsWith(":")) {
      data.keepAttr = true;
    }
  });
}

/**
 * Verwijdert `<img>` met src die vrijwel altijd 404't (placeholders, example.com, oude Unsplash-source).
 * Unsplash: alleen echte foto-paden (`/photo-<digits>-…`); geen `/random`, verzonnen id’s, etc.
 */
export function stripLikelyBrokenImgTags(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcM = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
    const src = srcM?.[1]?.trim() ?? "";
    if (!src) return "";
    if (/^javascript:/i.test(src)) return "";
    if (/^data:image\//i.test(src)) return tag;
    if (src.startsWith("/") || src.startsWith("./") || src.startsWith("../")) return tag;
    try {
      const u = new URL(src);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      const h = u.hostname.toLowerCase();
      if (h === "example.com" || h === "www.example.com" || h.endsWith(".example.com")) return "";
      if (h === "localhost" || h === "127.0.0.1") return "";
      if (h === "source.unsplash.com") return "";
      if (/^place(?:hold|holder)/i.test(h) || h === "via.placeholder.com" || h === "dummyimage.com") {
        return "";
      }
      if (h === "images.unsplash.com" || h === "plus.unsplash.com" || h === "cdn.unsplash.com") {
        const path = u.pathname.toLowerCase();
        if (!/^\/photo-\d+/i.test(path)) return "";
      }
    } catch {
      return "";
    }
    return tag;
  });
}

/** Na DOMPurify: kapotte img’s verbergen (404) zonder XSS — vaste handler, geen model-input. */
function appendImgOnErrorHide(html: string): string {
  return html.replace(/<img\b([^>]*?)\s*\/?>/gi, (full, attrs) => {
    const a = String(attrs);
    if (/\bonerror\s*=/i.test(a)) return full;
    const inner = a.trim();
    const sp = inner ? ` ${inner}` : "";
    return `<img${sp} onerror="this.remove()">`;
  });
}

/** Property-namen die inline \`style="…"\` mogen behouden (DOMPurify-hook). Geen \`<style>\`-tags in fragmenten. */
const SAFE_CSS_PROPERTY_RE = new RegExp(
  [
    "^\\s*(-webkit-)?(",
    [
      "background(-image|-color|-size|-position|-repeat)?",
      "color",
      "font(-family|-size|-weight|-style)?",
      "text-align",
      "opacity",
      "min-height",
      "min-width",
      "max-width",
      "max-height",
      "border-radius",
      "box-shadow",
      "letter-spacing",
      "line-height",
      "display",
      "flex",
      "gap",
      "padding",
      "margin",
      "width",
      "height",
      "transform",
      "transition",
      "will-change",
      "object-fit",
      "object-position",
      "aspect-ratio",
      "grid-template-(columns|rows)",
      "animation(-name|-duration|-delay|-iteration-count|-timing-function|-fill-mode|-play-state|-direction)?",
      "filter",
      "backdrop-filter",
      "position",
      "top",
      "right",
      "bottom",
      "left",
      "inset",
      "z-index",
      "overflow(-x|-y)?",
      "pointer-events",
      "visibility",
      "cursor",
      "justify-content",
      "align-items",
      "align-self",
      "flex-direction",
      "flex-wrap",
      "flex-grow",
      "flex-shrink",
      "flex-basis",
      "order",
    ].join("|"),
    ")\\s*$",
  ].join(""),
  "i",
);

function isAllowedInlineStyleProperty(prop: string): boolean {
  const p = prop.trim();
  if (/^--[\w-]+$/.test(p)) return true;
  return SAFE_CSS_PROPERTY_RE.test(p);
}

function sanitizeInlineStyle(value: string): string {
  return value
    .split(";")
    .filter((decl) => {
      const colon = decl.indexOf(":");
      if (colon <= 0) return false;
      const prop = decl.slice(0, colon);
      return isAllowedInlineStyleProperty(prop);
    })
    .join(";");
}

export function sanitizeTailwindFragment(html: string): string {
  ensureAlpineDomPurifyHook();

  if (!DOMPurify.isSupported) {
    return "";
  }

  const htmlForSanitize = stripDecorativeScrollCueMarkup(
    ensureAlpineMobileOverlayHasLgHidden(
      ensureAlpineMobileToggleButtonHasLgHidden(repairBrokenMobileDrawer(fixAlpineNavToggleDefaultsInXData(html))),
    ),
  );

  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && data.attrValue) {
      data.attrValue = sanitizeInlineStyle(data.attrValue);
    }
  });

  const purified = DOMPurify.sanitize(stripLikelyBrokenImgTags(htmlForSanitize), {
    ALLOWED_TAGS: [
      "a",
      "article",
      "aside",
      "blockquote",
      "br",
      "button",
      "details",
      "div",
      "form",
      "input",
      "label",
      "textarea",
      "select",
      "option",
      "template",
      "fieldset",
      "legend",
      "figcaption",
      "figure",
      "footer",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "header",
      "hr",
      "img",
      "li",
      "main",
      "nav",
      "ol",
      "p",
      "section",
      "source",
      "span",
      "strong",
      "em",
      "summary",
      "ul",
      "video",
      "svg",
      "path",
      "circle",
      "rect",
      "g",
      "line",
      /** Woordmerk / monogram in premium logo-SVG’s */
      "text",
      "tspan",
    ],
    ALLOWED_ATTR: [
      "class",
      "style",
      "href",
      "src",
      "alt",
      "target",
      "rel",
      "id",
      "role",
      "aria-label",
      "aria-hidden",
      "type",
      "open",
      "x-show",
      "x-cloak",
      "x-transition",
      "x-transition:enter",
      "x-transition:enter-start", 
      "x-transition:enter-end",
      "x-transition:leave",
      "x-transition:leave-start",
      "x-transition:leave-end",
      "fill",
      "fill-opacity",
      "viewBox",
      "xmlns",
      "width",
      "height",
      "x",
      "y",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "points",
      "text-anchor",
      "font-family",
      "font-weight",
      "font-size",
      "letter-spacing",
      "d",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "data-animation",
      "data-aos",
      "data-aos-offset",
      "data-aos-delay",
      "data-aos-duration",
      "data-aos-easing",
      "data-aos-mirror",
      "data-aos-once",
      "data-aos-anchor",
      "data-aos-anchor-placement",
      "data-lucide",
      "data-studio-brand-mark",
      "data-studio-visibility",
      /** Compose / nav / contrast — anders strip DOMPurify ze weg (`ALLOW_DATA_ATTR: false`). */
      "data-studio-skip-nav-tone",
      "data-studio-module",
      "data-studio-module-link",
      "data-studio-nav-module",
      "data-studio-module-cta",
      "data-studio-feature-zone",
      /** Ankers / secties in client-HTML. */
      "data-section",
      "name",
      "value",
      "placeholder",
      "disabled",
      "required",
      "readonly",
      "checked",
      "selected",
      "for",
      "rows",
      "cols",
      "min",
      "max",
      "step",
      "pattern",
      "autocomplete",
      "minlength",
      "maxlength",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "poster",
      "preload",
      "controls",
    ],
    ALLOW_DATA_ATTR: false,
  });
  DOMPurify.removeHook("uponSanitizeAttribute");
  return appendImgOnErrorHide(purified);
}

function escapeDataAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function sanitizeCssHex(input: string): string {
  const t = input.trim();
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(t)) return t;
  return "#6366f1";
}

function sanitizeCssHexOptional(input: string | undefined, fallback: string): string {
  if (!input?.trim()) return sanitizeCssHex(fallback);
  return sanitizeCssHex(input);
}

export function sanitizeFontStackForPage(input: string): string {
  const s = input
    .replace(/[;{}<>]/g, "")
    .replace(/["'`]/g, "")
    .slice(0, 160)
    .trim();
  return s || "Inter, system-ui, sans-serif";
}

function googleFontsLinkHref(fontFamily: string): string | null {
  const first = fontFamily.split(",")[0].trim().replace(/^["'`]|["'`]$/g, "");
  if (
    !first ||
    /^(system-ui|ui-sans-serif|ui-serif|inherit|default|serif|sans-serif|monospace)$/i.test(first)
  ) {
    return null;
  }
  const param = encodeURIComponent(first).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${param}:wght@400;500;600;700;800&display=swap`;
}

function tailwindRadiusBodyClass(input: string): string {
  const t = input.trim();
  if (/^rounded(-[a-z0-9]+)?$/.test(t)) return ` ${t}`;
  return "";
}

const defaultInterFontHref =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";

export function buildRootCssVarsForTailwindPage(pageConfig: TailwindPageConfig | null | undefined): {
  fontLink: string;
  fontStack: string;
  rootCss: string;
  radiusClass: string;
} {
  if (!pageConfig) {
    return {
      fontLink: defaultInterFontHref,
      fontStack: "Inter, system-ui, sans-serif",
      rootCss: "",
      radiusClass: "",
    };
  }

  if (isLegacyTailwindPageConfig(pageConfig)) {
    const fontHref = googleFontsLinkHref(pageConfig.fontFamily);
    const primary = sanitizeCssHex(pageConfig.primaryColor);
    return {
      fontLink: fontHref ?? defaultInterFontHref,
      fontStack: sanitizeFontStackForPage(pageConfig.fontFamily),
      rootCss: `:root { --page-primary: ${primary}; }`,
      radiusClass: tailwindRadiusBodyClass(pageConfig.borderRadius),
    };
  }

  const { theme, font } = pageConfig;
  const fontHref = googleFontsLinkHref(font);
  const p = sanitizeCssHex(theme.primary);
  const accent = sanitizeCssHex(theme.accent);
  const pLight = sanitizeCssHexOptional(theme.primaryLight, theme.primary);
  const pMain = sanitizeCssHexOptional(theme.primaryMain, theme.primary);
  const pDark = sanitizeCssHexOptional(theme.primaryDark, theme.primary);

  const cssVarLines = [
    `--page-primary: ${p}`,
    `--page-accent: ${accent}`,
    `--page-primary-light: ${pLight}`,
    `--page-primary-main: ${pMain}`,
    `--page-primary-dark: ${pDark}`,
  ];

  if (theme.secondary?.trim()) {
    cssVarLines.push(`--page-secondary: ${sanitizeCssHex(theme.secondary)}`);
  }
  if (theme.secondaryLight?.trim()) {
    cssVarLines.push(`--page-secondary-light: ${sanitizeCssHex(theme.secondaryLight)}`);
  }
  if (theme.secondaryMain?.trim()) {
    cssVarLines.push(`--page-secondary-main: ${sanitizeCssHex(theme.secondaryMain)}`);
  }
  if (theme.secondaryDark?.trim()) {
    cssVarLines.push(`--page-secondary-dark: ${sanitizeCssHex(theme.secondaryDark)}`);
  }
  if (theme.background?.trim()) {
    cssVarLines.push(`--page-background: ${sanitizeCssHex(theme.background)}`);
  }
  if (theme.textColor?.trim()) {
    cssVarLines.push(`--page-text: ${sanitizeCssHex(theme.textColor)}`);
  }
  if (theme.textMuted?.trim()) {
    cssVarLines.push(`--page-text-muted: ${sanitizeCssHex(theme.textMuted)}`);
  }

  return {
    fontLink: fontHref ?? defaultInterFontHref,
    fontStack: sanitizeFontStackForPage(font),
    rootCss: `:root {
    ${cssVarLines.join(";\n    ")};
  }`,
    radiusClass: "",
  };
}

/** Zelfde limiet als `generateMetadata` op `/site/[slug]` (te grote data-URL’s breken SSR). */
export const MAX_FAVICON_DATA_URL_CHARS = 12_000;

/**
 * `<link rel="icon">` voor geëxporteerde HTML en iframe-srcDoc wanneer er een merk-favicon is.
 * De live Next-route zet parallel `metadata.icons` (zie `app/(public)/site/[slug]/page.tsx`).
 */
export function buildFaviconLinkTagForLogoSet(logoSet?: GeneratedLogoSet | null): string {
  const fav = logoSet?.variants?.favicon?.trim() ?? "";
  if (!fav || fav.length > MAX_FAVICON_DATA_URL_CHARS) return "";
  return `<link rel="icon" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(fav)}" type="image/svg+xml"/>`;
}

export type BuildTailwindSectionsBodyOptions = {
  logoSet?: GeneratedLogoSet | null;
};

export function buildTailwindSectionsBodyInnerHtml(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
  bodyOptions?: BuildTailwindSectionsBodyOptions,
): string {
  const prepared =
    bodyOptions?.logoSet != null
      ? applyBrandLogoFallbackToSections(sections, bodyOptions.logoSet)
      : sections;
  return prepared
    .map(
      (s) =>
        `<section data-section="${escapeDataAttr(s.sectionName)}" class="w-full">${sanitizeTailwindFragment(s.html)}</section>`,
    )
    .join("\n");
}

const STUDIO_PREVIEW_BRIDGE_SCRIPT = `<script>
(function(){
  var SRC="studio-tailwind-preview";
  function post(msg){try{if(window.parent!==window)window.parent.postMessage(Object.assign({source:SRC},msg),"*");}catch(e){}}
  function measure(){
    var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
    post({type:"studio-preview-height",height:Math.ceil(h)});
  }
  post({type:"studio-preview-ready"});
  if(document.readyState==="complete")measure();
  else window.addEventListener("load",measure);
  window.addEventListener("resize",function(){measure();});
})();
</script>`;

/**
 * Gegenereerde one-pagers gebruiken vaak `href="/diensten"` of **absolute** `https://host/site/slug#x`
 * i.p.v. `#sectie`. In een `srcDoc`-iframe laadt dat de **hele Next-pagina opnieuw in de iframe**
 * (geneste iframe → miniatuur in de hoek). Vang dat af: zelfde-document scroll op hash/`data-section`,
 * of blokkeer host-navigatie. **Uitzondering:** `/site/{slug}/{subroute}` (contact, marketingpagina) is een echte
 * Next-route — dan `navigateTop` (postMessage naar parent / top) i.p.v. scrollen in de iframe.
 * Links naar app-shell (`/portal/*`, `/admin`, `/login`, `/home`, `/dashboard`) moeten **top** navigeren,
 * anders blijft de adresbalk op `/` en zie je o.a. kale login in de iframe.
 *
 * **Concept + token:** zorg dat interne `/site/{slug}/…`-links de `token`-query behouden (en oude `/preview/…`-links naar `/site/…` normaliseren).
 */
export function buildStudioSinglePageInternalNavScript(
  draftSiteNavRewrite: { slug: string; token: string } | null,
): string {
  const draftJson =
    draftSiteNavRewrite != null &&
    typeof draftSiteNavRewrite.slug === "string" &&
    draftSiteNavRewrite.slug.trim() !== "" &&
    typeof draftSiteNavRewrite.token === "string" &&
    draftSiteNavRewrite.token.trim() !== ""
      ? JSON.stringify({
          slug: draftSiteNavRewrite.slug.trim(),
          token: draftSiteNavRewrite.token.trim(),
        })
      : "null";
  return `<script>
(function(){
  var STUDIO_NAV=${JSON.stringify(STUDIO_PUBLIC_NAV_MESSAGE_SOURCE)};
  var DRAFT_SITE_NAV_REWRITE=${draftJson};
  function rewriteDraftSiteNavUrl(absUrl){
    if(!DRAFT_SITE_NAV_REWRITE)return absUrl;
    try{
      var u=new URL(absUrl);
      var slug=DRAFT_SITE_NAV_REWRITE.slug;
      var tok=DRAFT_SITE_NAV_REWRITE.token;
      var path=u.pathname||"";
      var prefSite="/site/"+slug;
      var prefPrev="/preview/"+slug;
      function mergeQuery(out){
        out.hash=u.hash;
        out.searchParams.set("token",tok);
        u.searchParams.forEach(function(v,k){
          if(k!=="token"&&v!=null&&String(v).length)out.searchParams.set(k,v);
        });
        return out.toString();
      }
      if(path===prefPrev||path.indexOf(prefPrev+"/")===0){
        var tailPrev=path.slice(prefPrev.length);
        var outP=new URL(u.origin+prefSite+tailPrev);
        return mergeQuery(outP);
      }
      if(path!==prefSite&&path.indexOf(prefSite+"/")!==0)return absUrl;
      var outS=new URL(u.toString());
      return mergeQuery(outS);
    }catch(_){return absUrl;}
  }
  function splitHashQuery(s){
    var hash="";
    var hi=s.indexOf("#");
    if(hi>=0){hash=s.slice(hi+1);s=s.slice(0,hi);}
    var qi=s.indexOf("?");
    if(qi>=0)s=s.slice(0,qi);
    return{path:s,hash:hash};
  }
  function isAppShellPath(path){
    if(!path||path.charAt(0)!=="/")return false;
    if(path.indexOf("/portal/")===0)return true;
    if(path.indexOf("/admin")===0)return true;
    if(path==="/login"||path.indexOf("/login/")===0)return true;
    if(path==="/home"||path==="/dashboard")return true;
    if(path.indexOf("/api/")===0||path.indexOf("/_next")===0)return true;
    return false;
  }
  function navigateTop(e,a){
    e.preventDefault();
    var url=rewriteDraftSiteNavUrl(a.href);
    if(window.top!==window){
      try{window.top.location.assign(url);return;}catch(_){}
      try{
        if(window.parent&&window.parent!==window){
          window.parent.postMessage({source:STUDIO_NAV,href:url},window.location.origin||"*");
          return;
        }
      }catch(_){}
      try{window.open(url,"_top");return;}catch(_){}
    }
    try{window.location.assign(url);}catch(_){window.location.assign(a.getAttribute("href"));}
  }
  function slugifyNavKey(s){
    return (s||"").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  }
  /* sitePublicPathDepth: pathname onder /site/ — twee segmenten = landing, drie = contact of marketing */
  function sitePublicPathDepth(pathname){
    var p=pathname||"";
    if(p.indexOf("/site/")!==0)return 0;
    return p.split("/").filter(Boolean).length;
  }
  function tryScroll(e,id){
    if(!id)return false;
    try{id=decodeURIComponent(id);}catch(_){}
    var key=slugifyNavKey(id);
    function finishScroll(el){
      if(!el)return false;
      e.preventDefault();
      el.scrollIntoView({behavior:"smooth",block:"start"});
      return true;
    }
    var el=document.getElementById(id);
    if(el)return finishScroll(el);
    if(typeof CSS!=="undefined"&&CSS.escape){
      try{
        el=document.querySelector('[data-section="'+CSS.escape(id)+'"]');
        if(el)return finishScroll(el);
      }catch(_){}
    }
    var nodes=document.querySelectorAll("[id]");
    for(var i=0;i<nodes.length;i++){
      var nid=nodes[i].id;
      if(nid&&slugifyNavKey(nid)===key)return finishScroll(nodes[i]);
    }
    var secs=document.querySelectorAll("[data-section]");
    for(var j=0;j<secs.length;j++){
      var ds=secs[j].getAttribute("data-section");
      if(ds&&slugifyNavKey(ds)===key)return finishScroll(secs[j]);
    }
    return false;
  }
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest&&e.target.closest("a[href]");
    if(!a)return;
    if(a.getAttribute("target")==="_blank")return;
    var raw=a.getAttribute("href");
    if(!raw)return;
    var href=raw.trim();
    if(!href||/^(mailto:|tel:|javascript:)/i.test(href))return;
    if(href.charAt(0)==="#")return;
    var pqApp=splitHashQuery(href);
    if(isAppShellPath(pqApp.path)){navigateTop(e,a);return;}
    if(/^https?:\\/\\//i.test(href)){
      try{
        var u=new URL(href);
        var pn=u.pathname||"";
        if(isAppShellPath(pn)){navigateTop(e,a);return;}
        if(pn.indexOf("/site/")===0){
          e.preventDefault();
          if(sitePublicPathDepth(pn)>2){
            navigateTop(e,a);
            return;
          }
          var ah=href.indexOf("#");
          var siteHash=ah>=0?href.slice(ah+1):"";
          if(tryScroll(e,siteHash))return;
          window.scrollTo({top:0,behavior:"smooth"});
          return;
        }
        /* Zelfde origin als parent/srcDoc: géén echte iframe-navigatie (die laadt /prijzen etc. in de iframe → wit/kapot beeld). */
        if(u.origin===window.location.origin){
          e.preventDefault();
          var sh=u.hash&&u.hash.length>1?u.hash.slice(1):"";
          if(pn==="/"||pn===""){
            window.scrollTo({top:0,behavior:"smooth"});
            return;
          }
          var ap=pn.split("/").filter(Boolean);
          if(ap.length!==1)return;
          if(tryScroll(e,ap[0]))return;
          if(sh&&tryScroll(e,sh))return;
          return;
        }
      }catch(_){}
      /* Voorkom navigatie naar dev-hosts (localhost in opgeslagen HTML) → ERR_CONNECTION_REFUSED buiten dev. */
      try{
        var uDev=new URL(href);
        var hDev=(uDev.hostname||"").toLowerCase();
        if(hDev==="localhost"||hDev==="127.0.0.1"||hDev==="::1"){
          e.preventDefault();
        }
      }catch(_dev){}
      return;
    }
    var pq=splitHashQuery(href);
    var path=pq.path;
    var hash=pq.hash;
    if(path.indexOf("/site/")===0){
      e.preventDefault();
      if(sitePublicPathDepth(path)>2){
        navigateTop(e,a);
        return;
      }
      if(tryScroll(e,hash))return;
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    if(path==="/"||path===""){
      e.preventDefault();
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    if(path.charAt(0)!=="/")return;
    var parts=path.split("/").filter(Boolean);
    if(parts.length!==1){
      e.preventDefault();
      return;
    }
    if(tryScroll(e,parts[0]))return;
    e.preventDefault();
  },true);
})();
</script>`;
}

export type BuildTailwindIframeSrcDocOptions = {
  /** Stuurt ready + documenthoogte naar parent via postMessage (alleen zinvol in iframe). */
  previewPostMessageBridge?: boolean;
  /** Ruwe strings uit site_data_json; CSS wordt gesanitiseerd, JS via base64-bootstrap. */
  userCss?: string;
  userJs?: string;
  /** Premium merk-SVG: fallback-injectie in header/nav/section als model het logo oversloeg. */
  logoSet?: GeneratedLogoSet | null;
  /** Vervangt studio-placeholders in de body-HTML (live site + preview). */
  publishedSlug?: string;
  /** `false` wanneer afspraken-module uit: geen `/boek/`-links uit placeholder. */
  appointmentsEnabled?: boolean;
  /** `false` wanneer webshop-module uit: geen `/winkel/`-links uit placeholder. */
  webshopEnabled?: boolean;
  /**
   * `true`: schakel scroll-reveal uit (statische `data-animation`, geen IO-script) — alleen nuttig bij
   * tijdelijke debugging; standaard **uit** laten zodat `/site` en studio-preview gelijk lopen aan ZIP-export.
   */
  disableScrollRevealAnimations?: boolean;
  /**
   * Server-gecompileerde Tailwind (minified). Gezet → geen Play CDN / FOUC-wacht.
   */
  compiledTailwindCss?: string | null;
  /**
   * Optioneel: `/site/[slug]` ↔ `/site/[slug]/contact` zonder generator-output te wijzigen.
   * Vereist `pageOrigin` (typisch `window.location.origin` in de client-build van `srcDoc`).
   */
  contactSubpageNav?: ContactSubpageNavScriptInput;
  /**
   * Publieke concept-preview: portaal-placeholder → `#` (geen `/portal/…` → inlogscherm) en contact-nav gebruikt token-URL.
   */
  draftPublicPreviewToken?: string | null;
  /**
   * Studio iframe-preview: `width=device-width` in een smal paneel triggert mobiele Tailwind-breakpoints.
   * Zet dit aan om de layout te laten aansluiten op het **browservenster** (desktop vs mobiel), niet op de iframewidth.
   */
  previewMatchParentWindowBreakpoints?: boolean;
  /**
   * HTML-editor: zet `data-gentrix-studio-mobile` op `<html>` + extra CSS om dubbele desktop-nav
   * naast hamburger te onderdrukken. Aan bij expliciete mobiele preview óf Autom. op smal
   * browservenster (`device-width`); uit bij Desktop-preview of brede auto (geen effect op live `/site`).
   */
  studioMobileEditorFrame?: boolean;
  /**
   * Client-only: `window.location.origin` — laadt Alpine/Lucide/AOS/GSAP/Tailwind-play via
   * `/api/public/studio-preview-lib` (zelfde origin) i.p.v. jsDelivr/unpkg, zodat o.a. Edge Tracking Prevention
   * Alpine niet blokkeert in sandboxed `srcDoc`.
   */
  previewScriptOrigin?: string | null;
  /**
   * Korte merknaam voor de geïnjecteerde auto-navbar (niet `config.style` — dat is een briefing).
   */
  navBrandLabel?: string | null;
};

/**
 * AI-headers met @click op de hamburger maar **zonder** `x-data` op de header of een ancestor:
 * Alpine bindt directives dan niet → knoppen doen niets. Repareer met minimale scope + `initTree`.
 */
function buildAlpineMobileHeaderScopeRepairScript(): string {
  return `<script>
(function(){
  function findMobileMenuBtn(root){
    if(!root||!root.querySelector)return null;
    return (
      root.querySelector('button[class*="sm:hidden"]')||
      root.querySelector('button[class*="md:hidden"]')||
      root.querySelector('button[class*="lg:hidden"]')||
      root.querySelector('button[class*="xl:hidden"]')||
      root.querySelector('button[aria-label*="enu"]')||
      root.querySelector('button[aria-label*="Menu"]')||
      root.querySelector('button[aria-label*="menu"]')
    );
  }
  function panelXShowOutsideHeader(sec,hdr){
    if(!sec||!sec.querySelector||!hdr)return false;
    var nodes=sec.querySelectorAll("[x-show]");
    var i,n;
    for(i=0;i<nodes.length;i++){
      n=nodes[i];
      if(n&&!hdr.contains(n))return true;
    }
    return false;
  }
  /** x-show op sheet **naast** header: zelfde scope moet op section, niet alleen op header. */
  function repairSectionNavScope(Alp){
    var secs=document.querySelectorAll("section.w-full,section[class*='w-full']");
    var si,sec,hdr,btn,ck,m,key,allow;
    allow={navOpen:1,menuOpen:1,open:1,mobileOpen:1,drawerOpen:1,menuVisible:1,mobileMenuOpen:1};
    for(si=0;si<secs.length;si++){
      sec=secs[si];
      if(!sec||sec.getAttribute("data-gentrix-auto-mobile-nav")==="1")continue;
      if(sec.getAttribute("x-data"))continue;
      hdr=sec.querySelector("header");
      if(!hdr)continue;
      btn=findMobileMenuBtn(hdr);
      if(!btn)continue;
      if(btn.closest("[x-data]"))continue;
      if(!panelXShowOutsideHeader(sec,hdr))continue;
      ck=(btn.getAttribute("@click")||btn.getAttribute("x-on:click")||"").trim();
      if(!ck)continue;
      m=/^\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=/.exec(ck);
      key=m?m[1]:"navOpen";
      if(!allow[key])key="navOpen";
      sec.setAttribute("x-data","{ "+key+": false }");
      Alp.initTree(sec);
    }
  }
  function repairRoot(h,Alp){
    if(!h||h.getAttribute("data-gentrix-auto-mobile-nav")==="1")return false;
    if(h.getAttribute("x-data"))return false;
    var btn=findMobileMenuBtn(h);
    if(!btn)return false;
    if(btn.closest("[x-data]"))return false;
    var ck=(btn.getAttribute("@click")||btn.getAttribute("x-on:click")||"").trim();
    if(!ck)return false;
    var m=/^\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=/.exec(ck);
    var key=m?m[1]:"navOpen";
    var allow={navOpen:1,menuOpen:1,open:1,mobileOpen:1,drawerOpen:1,menuVisible:1,mobileMenuOpen:1};
    if(!allow[key])key="navOpen";
    h.setAttribute("x-data","{ "+key+": false }");
    Alp.initTree(h);
    return true;
  }
  function repair(){
    try{
      var Alp=window.Alpine;
      if(!Alp||typeof Alp.initTree!=="function")return;
      repairSectionNavScope(Alp);
      var roots=document.querySelectorAll("header,[role='banner']");
      var i;
      for(i=0;i<roots.length;i++)repairRoot(roots[i],Alp);
      var bars=document.querySelectorAll('body > div[class*="fixed"][class*="top-0"]');
      for(i=0;i<bars.length;i++){
        var d=bars[i];
        if(d.closest("header")||d.closest('[role="banner"]'))continue;
        repairRoot(d,Alp);
      }
    }catch(e){try{console.warn("[gentrix-nav-repair]",e);}catch(_){}}
  }
  document.addEventListener("alpine:initialized",function(){
    queueMicrotask(repair);
    setTimeout(repair,140);
    setTimeout(repair,420);
  });
})();
<\/script>`;
}

/**
 * Studio/preview: bij Tailwind `lg`+ (iframe 1280 of smal venster → breed) alle mobiele nav-toggle-state
 * in header/banner resetten. Zo blijft een op mobiel geopend menu niet “plakken” bij desktop-weergave,
 * en wint geen oude Alpine-state over `lg:hidden` (x-show inline).
 */
function buildStudioIframeNavResetOnDesktopViewportScript(): string {
  const keysLiteral = ALPINE_NAV_TOGGLE_KEYS.map((k) => JSON.stringify(k)).join(",");
  return `<script defer>
(function(){
  if(document.documentElement.getAttribute("data-gentrix-studio-iframe")!=="1")return;
  var mq=window.matchMedia("(min-width:1024px)");
  var KEYS=[${keysLiteral}];
  function sectionHasMobileHeaderNav(sec){
    if(!sec||sec.tagName!=="SECTION"||!sec.querySelector)return false;
    var cls=(sec.className&&String(sec.className))||"";
    if(cls.indexOf("w-full")<0)return false;
    var hdr=sec.querySelector("header");
    if(!hdr)return false;
    return !!(
      hdr.querySelector('button[class*="sm:hidden"]')||
      hdr.querySelector('button[class*="md:hidden"]')||
      hdr.querySelector('button[class*="lg:hidden"]')||
      hdr.querySelector('button[aria-label*="enu"]')||
      hdr.querySelector('button[aria-label*="Menu"]')||
      hdr.querySelector('button[aria-label*="menu"]')
    );
  }
  function isNavChrome(el){
    if(!el||el.closest("footer"))return false;
    if(el.tagName==="HEADER")return true;
    if(el.getAttribute&&String(el.getAttribute("role")||"").toLowerCase()==="banner")return true;
    if(el.parentElement===document.body){
      var c=(el.className&&String(el.className))||"";
      if(c.indexOf("fixed")>=0&&c.indexOf("top-0")>=0)return true;
    }
    if(el.tagName==="SECTION"&&sectionHasMobileHeaderNav(el))return true;
    return false;
  }
  function extraNavBoolKey(k){
    if(typeof k!=="string"||k.length>64)return false;
    var i,kl=k.toLowerCase();
    for(i=0;i<KEYS.length;i++)if(KEYS[i]===k)return true;
    if(k==="open")return true;
    if(/^is(Open|MenuOpen|NavOpen|DrawerOpen)$/i.test(k))return true;
    if(!/Open$/i.test(k))return false;
    return kl.indexOf("menu")>=0||kl.indexOf("nav")>=0||kl.indexOf("drawer")>=0||kl.indexOf("sheet")>=0
      ||kl.indexOf("sidebar")>=0||kl.indexOf("panel")>=0||kl.indexOf("overlay")>=0||kl.indexOf("burger")>=0
      ||kl.indexOf("flyout")>=0||kl.indexOf("offcanvas")>=0||kl.indexOf("mobile")>=0||kl.indexOf("hamb")>=0;
  }
  function closeNavScopes(){
    if(!mq.matches)return;
    var Alp=window.Alpine;
    if(!Alp||typeof Alp.$data!=="function")return;
    document.querySelectorAll("[x-data]").forEach(function(el){
      if(!isNavChrome(el))return;
      var d;
      try{d=Alp.$data(el);}catch(_){return;}
      if(!d)return;
      var i,k;
      for(i=0;i<KEYS.length;i++){
        k=KEYS[i];
        if(Object.prototype.hasOwnProperty.call(d,k)&&d[k]===true)d[k]=false;
      }
      for(k in d){
        if(!Object.prototype.hasOwnProperty.call(d,k))continue;
        if(d[k]!==true)continue;
        if(!extraNavBoolKey(k))continue;
        d[k]=false;
      }
    });
  }
  function tick(){ closeNavScopes(); }
  mq.addEventListener("change",tick);
  window.addEventListener("resize",tick,{passive:true});
  document.addEventListener("alpine:initialized",function(){
    queueMicrotask(tick);
    setTimeout(tick,80);
    setTimeout(tick,400);
  });
})();
<\/script>`;
}

export function buildTailwindIframeSrcDoc(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
  options?: BuildTailwindIframeSrcDocOptions,
): string {
  let body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {
    logoSet: options?.logoSet,
  });
  const existingHeaderLinks = extractHeaderNavLinks(body);
  const shouldInject = shouldInjectStudioAutoMobileNav(body);
  console.log("[nav] shouldInject:", shouldInject);
  console.log("[nav] sections.length:", sections.length);
  let studioAutoMobileNavInjected = false;
  if (sections.length > 0 && shouldInject) {
    body = `${buildStudioAutoMobileNavHeaderHtml(
      sections,
      pageConfig ?? null,
      {
        logoSet: options?.logoSet,
        navBrandLabel: options?.navBrandLabel?.trim() || null,
      },
      existingHeaderLinks,
    )}\n${body}`;
    studioAutoMobileNavInjected = true;
  }
  const slug = options?.publishedSlug?.trim();
  if (slug) {
    const previewTok = options?.draftPublicPreviewToken?.trim();
    body = applyStudioPublishedPathPlaceholders(body, slug, {
      resolvePortalPath: previewTok ? false : undefined,
    });
    body = stripLeakedStudioPlaceholderTokens(body);
  } else {
    body = neutralizeStudioPathPlaceholdersWithoutSlug(body);
    body = stripLeakedStudioPlaceholderTokens(body);
  }
  const { fontLink, fontStack, rootCss, radiusClass } = buildRootCssVarsForTailwindPage(pageConfig ?? null);
  const themeMeta =
    pageConfig && !isLegacyTailwindPageConfig(pageConfig)
      ? `<meta name="generator" content="${escapeDataAttr(pageConfig.style)}"/>`
      : pageConfig && isLegacyTailwindPageConfig(pageConfig)
        ? `<meta name="generator" content="${escapeDataAttr(pageConfig.themeName)}"/>`
        : "";

  const bridge = options?.previewPostMessageBridge !== false ? STUDIO_PREVIEW_BRIDGE_SCRIPT : "";
  const userCssRaw = options?.userCss?.trim() ?? "";
  const userJsRaw = options?.userJs?.trim() ?? "";
  const userCssBlock = userCssRaw
    ? `<style id="studio-user-css">\n${sanitizeUserSiteCss(userCssRaw)}\n</style>`
    : "";
  const userJsBlock = userJsRaw ? buildUserScriptTagForHtmlDocument(userJsRaw) : "";

  const animationCss =
    (options?.disableScrollRevealAnimations
      ? STUDIO_DATA_ANIMATION_DISABLED_CSS + STUDIO_BORDER_REVEAL_DISABLED_CSS
      : STUDIO_DATA_ANIMATION_CSS + STUDIO_BORDER_REVEAL_CSS) +
    "\n" +
    STUDIO_MARQUEE_CSS +
    "\n" +
    STUDIO_LASER_LINE_CSS;
  const scrollRevealScript = options?.disableScrollRevealAnimations ? "" : STUDIO_SCROLL_REVEAL_SCRIPT;
  const motionDisabled = Boolean(options?.disableScrollRevealAnimations);
  const { headLink: aosHeadLink, bodyScripts: aosBodyScripts } = getStudioAosHtmlFragments(motionDisabled);
  const { bodyScripts: gsapBodyScripts } = getStudioGsapHtmlFragments(motionDisabled);
  const faviconLink = buildFaviconLinkTagForLogoSet(options?.logoSet);
  const headMetaExtras = [faviconLink && `  ${faviconLink}`, themeMeta && `  ${themeMeta}`]
    .filter(Boolean)
    .join("\n");

  const compiledRaw = options?.compiledTailwindCss?.trim() ?? "";
  const useCompiledTailwind = compiledRaw.length > 0;
  const compiledStyleBlock = useCompiledTailwind
    ? `<style id="studio-compiled-tailwind">\n${sanitizeCompiledTailwindCssForStyleTag(compiledRaw)}\n</style>\n`
    : "";
  const tailwindPreloadLine = useCompiledTailwind
    ? ""
    : `  <link rel="preload" href="${STUDIO_TAILWIND_PLAY_CDN_SRC}" as="script"/>\n`;
  const foucCssBlock = useCompiledTailwind ? "" : `    ${STUDIO_TAILWIND_FOUC_HEAD_CSS}\n`;
  const twLoadingScript = useCompiledTailwind ? "" : `<script>document.documentElement.classList.add("tw-loading")</script>\n`;
  const tailwindCdnScripts = useCompiledTailwind
    ? ""
    : `<script src="${STUDIO_TAILWIND_PLAY_CDN_SRC}" onload="(function(e){e.classList.remove('tw-loading');e.classList.add('tw-ready')})(document.documentElement)" onerror="(function(e){e.classList.remove('tw-loading');e.classList.add('tw-ready')})(document.documentElement)"></script>
<script>setTimeout(function(){var e=document.documentElement;if(e.classList.contains("tw-loading")){e.classList.remove("tw-loading");e.classList.add("tw-ready")}},4500)</script>
`;
  const studioTailwindPlayConsoleMute = useCompiledTailwind
    ? ""
    : `<script>(function(){var p=console.warn;console.warn=function(){var s="",i,a=arguments;for(i=0;i<a.length;i++)s+=String(a[i]);if(s.indexOf("cdn.tailwindcss.com")!==-1&&s.indexOf("should not be used in production")!==-1)return;p.apply(console,a);}})();</script>
`;

  const contactSubpageNavRaw = options?.contactSubpageNav;
  const contactSubpageNav =
    contactSubpageNavRaw != null
      ? {
          ...contactSubpageNavRaw,
          draftPublicPreviewToken:
            contactSubpageNavRaw.draftPublicPreviewToken ?? options?.draftPublicPreviewToken ?? undefined,
        }
      : undefined;
  const contactSubpageScript =
    contactSubpageNav?.pageOrigin?.trim().length &&
    contactSubpageNav.slug?.trim().length &&
    ((contactSubpageNav.marketingSlugs?.length ?? 0) > 0 || (contactSubpageNav.landingSectionIds?.length ?? 0) > 0)
      ? buildContactSubpageCaptureNavScript(contactSubpageNav)
      : "";

  const draftTok = options?.draftPublicPreviewToken?.trim() ?? "";
  const draftSlug = options?.publishedSlug?.trim() ?? "";
  const draftSiteNavRewrite =
    draftTok.length > 0 && draftSlug.length > 0 ? { slug: draftSlug, token: draftTok } : null;

  const viewportContent = options?.previewMatchParentWindowBreakpoints
    ? "width=1280, initial-scale=1"
    : "width=device-width, initial-scale=1";

  const studioMobileAttr = options?.studioMobileEditorFrame ? ` data-gentrix-studio-mobile="1"` : "";
  const studioMobileCss = options?.studioMobileEditorFrame
    ? `${STUDIO_MOBILE_EDITOR_FRAME_NAV_CSS}\n${STUDIO_IFRAME_MOBILE_EDITOR_NAV_SHEET_CSS}\n`
    : "";
  const iframeShellAttr = ` data-gentrix-studio-iframe="1"`;
  const autoNavDupCss = studioAutoMobileNavInjected
    ? `${STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS}\n${STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS}\n`
    : "";
  const bodyTopIdAttr = studioAutoMobileNavInjected ? ` id="top"` : "";

  // Zonder compiled CSS: Tailwind Play CDN onderaan body (JIT) + FOUC-guard.
  let out = `<!DOCTYPE html>
<html lang="nl"${iframeShellAttr}${studioMobileAttr}>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="${escapeDataAttr(viewportContent)}"/>
${headMetaExtras ? `${headMetaExtras}\n` : ""}${tailwindPreloadLine}  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontLink}" rel="stylesheet"/>
  <style>
    ${STUDIO_ALPINE_X_CLOAK_CSS}
    ${STUDIO_MOBILE_TOGGLE_POINTER_FIX_CSS}
    /* Vaste top-nav (fixed) + hash-scroll: zonder padding komen koppen onder de balk (afgeknipt, "overlap"). */
    html { scroll-padding-top: 5.5rem; }
    body { font-family: ${fontStack}; }
    ${rootCss}
    ${animationCss}
    ${STUDIO_NAV_SCROLL_CONTRAST_CSS}
    ${STUDIO_MOBILE_MENU_STACKING_FIX_CSS}
    ${STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS}
    ${STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_GENERATED_SITE_NAVBAR_CLEANUP_CSS}
    ${autoNavDupCss}    ${studioMobileCss}${foucCssBlock}  </style>
  ${compiledStyleBlock}${userCssBlock}
${aosHeadLink}</head>
<body class="antialiased text-slate-900${radiusClass}"${bodyTopIdAttr}>
${twLoadingScript}${body}
${studioTailwindPlayConsoleMute}${tailwindCdnScripts}${buildLucideRuntimeScriptBlock()}<script>
(function(){
  document.addEventListener("alpine:initialized",function(){
    queueMicrotask(function(){
      try{if(typeof window.__gentrixNavClamp==="function")window.__gentrixNavClamp(true);}catch(_){}
    });
    setTimeout(function(){
      try{if(typeof window.__gentrixNavClamp==="function")window.__gentrixNavClamp(false);}catch(_){}
    },0);
  });
})();
</script>
<script defer src="${STUDIO_ALPINE_CDN_SRC}"></script>
${buildAlpineMobileHeaderScopeRepairScript()}
${buildStudioHeaderNavAlpineClampScript()}
${buildStudioIframeNavResetOnDesktopViewportScript()}
${buildLucidePostAlpineRescanScript()}
${scrollRevealScript}${gsapBodyScripts}${aosBodyScripts}
${STUDIO_NAV_SCROLL_CONTRAST_SCRIPT}
${contactSubpageScript}
${buildStudioSinglePageInternalNavScript(draftSiteNavRewrite)}
${bridge}
${userJsBlock}
</body>
</html>`;
  const po = options?.previewScriptOrigin?.trim();
  if (po) out = rewriteStudioPreviewExternalScripts(out, po);
  return out;
}
