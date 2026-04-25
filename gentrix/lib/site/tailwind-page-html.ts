/**
 * Server-safe Tailwind-landing HTML (DOMPurify + theme-vars). Gebruikt door iframe-preview en SSR-publieke routes.
 */
import DOMPurify from "isomorphic-dompurify";
import {
  ALPINE_NAV_TOGGLE_KEYS,
  ensureAlpineMobileOverlayHasLgHidden,
  convertMobileDrawerToPushDown,
  ensureAlpineMobileToggleButtonHasLgHidden,
  fixAlpineNavToggleDefaultsInXData,
  normalizeStudioHeroDomIdsAndRootMotion,
  repairBrokenMobileDrawer,
  alignChromeNavMdLgBreakpoints,
  repairHeaderMobileMenuButton,
  removeDuplicateAlpineNavScopeInHeader,
  stripDecorativeScrollCueMarkup,
} from "@/lib/ai/generate-site-postprocess";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import { buildStudioFontHeadFragment } from "@/lib/site/studio-font-head";
import { STUDIO_ALPINE_CDN_SRC } from "@/lib/site/studio-alpine-cdn";
import { STUDIO_LUCIDE_UMD_SRC } from "@/lib/site/studio-lucide-cdn";
import { STUDIO_TAILWIND_PLAY_CDN_SRC } from "@/lib/site/studio-tailwind-cdn";
import { applyBrandLogoFallbackToSections } from "@/lib/site/brand-logo-inject";
import { inferStudioNavChromeFromSections } from "@/lib/site/infer-studio-nav-chrome";
import {
  parseStudioNavChromeConfig,
  prependStudioNavChromeToFirstSection,
  renderStudioNavChromeHtml,
} from "@/lib/site/render-studio-nav-chrome-html";
import { resolveStudioNavUnderShellPolicy } from "@/lib/site/studio-shell-nav-policy";
import {
  applyStudioPublishedPathPlaceholders,
  neutralizeStudioPathPlaceholdersWithoutSlug,
  stripLeakedStudioPlaceholderTokens,
} from "@/lib/site/studio-section-visibility";
import {
  buildContactSubpageCaptureNavScript,
  type ContactSubpageNavScriptInput,
} from "@/lib/site/tailwind-contact-subpage";
import { buildMarketingSlugSegmentResolutionMap } from "@/lib/site/marketing-path-aliases";
import {
  STUDIO_HTML_EDITOR_IFRAME_NAV_SOURCE,
  STUDIO_PUBLIC_NAV_MESSAGE_SOURCE,
} from "@/lib/site/studio-public-nav-message";
import { sanitizeCompiledTailwindCssForStyleTag } from "@/lib/site/compiled-tailwind-css-sanitize";
import { replaceAllOpenTagsByLocalName } from "@/lib/site/html-open-tag";
import { rewriteStudioPreviewExternalScripts } from "@/lib/site/studio-preview-lib-registry";
import { buildUserScriptTagForHtmlDocument, sanitizeUserSiteCss } from "@/lib/site/user-site-assets";
import { STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { pickStudioSiteCreditVariant } from "@/lib/site/studio-site-shell";
import {
  MAX_FAVICON_DATA_URL_CHARS,
  resolvePublicSiteFaviconSvg,
} from "@/lib/site/site-identity-favicon";
import type { GeneratedLogoSet } from "@/types/logo";

export { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/site-identity-favicon";

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

/**
 * Cross-document View Transitions stonden hier ooit, maar veroorzaken een zichtbare witte flits
 * bij full-page SSR-navigatie (Optie A, geen iframe): de browser snapshot de oude pagina, laat die
 * kort vallen voor de nieuwe snapshot klaar is → wit gat. Browser-native navigatie houdt de oude
 * DOM zichtbaar tot de nieuwe klaar is — dat is exact wat we willen.
 */
export const STUDIO_VIEW_TRANSITION_CSS = "";

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
const STUDIO_AOS_INLINE_INIT = `(function(){function b(){if(!window.AOS)return;try{AOS.init({duration:600,once:true,offset:80,easing:"ease-out-cubic",throttleDelay:200,disable:window.matchMedia("(prefers-reduced-motion: reduce)").matches});}catch(_){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",b);else b();})();`;

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

function htmlUsesAosAttributes(html: string): boolean {
  return /\sdata-aos(?:-[a-z0-9-]+)?\s*=\s*(["'])[^"']*\1/i.test(html);
}

function scriptUsesAosRuntime(userJs: string): boolean {
  return /\bAOS\b/.test(userJs);
}

function scriptUsesGsapRuntime(userJs: string): boolean {
  return /\b(?:gsap|ScrollTrigger|MotionPathPlugin|Flip|Observer)\b/.test(userJs);
}

/**
 * Doel-URL achter **GENTRIX** in de hoek-credit. Override: `NEXT_PUBLIC_GENTRIX_CREDIT_URL` (Next bundelt naar client).
 */
export const STUDIO_SITE_CREDIT_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_GENTRIX_CREDIT_URL?.trim()) || "https://gentrix.nl";

/**
 * Signatuur **By GENTRIX** — bewust klein, maar **leesbaar** op donkere footers: lichte tekst op donkere pill.
 * **Geen** `transform: translateX(-50%)` en **geen** `backdrop-filter`: die combinaties geven in Chromium
 * vaak **wazige / korrelige** tekstraster (subpixels). Centreren met `width: max-content` + `margin: 0 auto`
 * en iets vollere achtergrond i.p.v. frosted blur.
 * **Onder midden** van de viewport. `z-index` onder typische nav (`~50`) en overlays.
 */
export const STUDIO_SITE_CREDIT_CSS = `[data-studio-site-credit]{position:fixed;left:0;right:0;bottom:max(0.65rem, env(safe-area-inset-bottom, 0px));width:max-content;max-width:min(calc(100vw - 1.25rem), 22rem);margin:0 auto;z-index:28;box-sizing:border-box;padding:0.35rem 0.75rem;text-align:center;font-family:ui-sans-serif, system-ui, sans-serif;font-size:11px;line-height:1.2;font-weight:500;letter-spacing:0.02em;color:rgba(248,250,252,0.92);pointer-events:none;white-space:nowrap;border-radius:9999px;background:rgba(15,23,42,0.9);box-shadow:0 1px 2px rgba(0,0,0,0.35);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}[data-studio-site-credit] a{color:inherit;text-decoration:underline;text-decoration-color:rgba(248,250,252,0.35);text-underline-offset:2px;pointer-events:auto;font-weight:600;letter-spacing:0.05em;outline-offset:3px}@media (hover:hover){[data-studio-site-credit] a:hover{color:#fff;text-decoration-color:rgba(255,255,255,0.55)}}`;

export const STUDIO_SITE_CREDIT_BODY_HTML = `<div data-studio-site-credit translate="no">By <a href="${STUDIO_SITE_CREDIT_URL}" target="_blank" rel="noopener noreferrer" aria-label="GENTRIX — meer informatie">GENTRIX</a></div>`;

/** Luminantie-drempel: eigen oppervlak van de nav is licht → altijd donkere chrome (icoon/links), ook als de hero onder de balk donker is. */
const STUDIO_NAV_SELF_SURFACE_LIGHT_LUM = 0.58;

export { pickStudioSiteCreditVariant } from "@/lib/site/studio-site-shell";

/**
 * `0` = standaard (fixed, onder midden). `1` = compact rechtsonder. `2` = onderaan document (scrollt mee t.o.v. viewport).
 * Variant 2 vereist `position: relative` op `body` (zet de iframe- en export-templates).
 */
export const STUDIO_SITE_CREDIT_VARIANT_CSS = `
html[data-gentrix-site-credit-variant="1"] [data-studio-site-credit]{
  left:auto;
  right:max(0.65rem, env(safe-area-inset-right, 0px));
  margin-left:0;
  margin-right:0;
  font-size:10px;
  padding:0.3rem 0.65rem;
  opacity:0.9;
}
html[data-gentrix-site-credit-variant="2"] [data-studio-site-credit]{
  position:absolute;
  opacity:0.78;
}
`;

/**
 * `scroll-padding` op `html` helpt alleen bij hash-scroll; `fixed` nav laat inhoud visueel onder de balk starten.
 *
 * **Dubbele inset:** veel AI-hero’s hebben al `pt-12` / `pt-16` op de eerste content-`div` na `header`. Dan is
 * `padding-top` op `#hero` **overbodig** en ontstaat een wit/grijs band **boven** de vaste balk + extra ruimte
 * tussen nav en hero (dubbele “navbar offset”).
 */
export const STUDIO_FIXED_NAV_HERO_INSET_CSS = `html[data-gentrix-studio-iframe="1"] section#hero:has(> header[class*="fixed"]),
html[data-gentrix-studio-iframe="1"] #hero:has(> header[class*="fixed"]) {
  padding-top: 5.5rem;
}
html[data-gentrix-studio-iframe="1"] section[data-section] > header[class*="fixed"] + #hero,
html[data-gentrix-studio-iframe="1"] section[data-section] > header[class*="fixed"] + section#hero {
  padding-top: 5.5rem;
}
html[data-gentrix-studio-iframe="1"] section#hero:has(> header[class*="fixed"] + *[class*="pt-"]),
html[data-gentrix-studio-iframe="1"] #hero:has(> header[class*="fixed"] + *[class*="pt-"]),
html[data-gentrix-studio-iframe="1"] section[data-section] > header[class*="fixed"] + section#hero:has(> *[class*="pt-"]) {
  padding-top: 0 !important;
}
`;

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
 * Sommige AI-modellen gebruiken `text-2xl`/`text-3xl`/`text-4xl` op de links en CTA's in hun
 * mobiele drawer. Dat overheerst de rest van de typografie en voelt niet als "website-nav".
 * Cap daarom de font-grootte binnen `nav[aria-label="Mobiel menu"]` (en varianten) naar de
 * standaard body/nav-grootte. Dit mapt 1-op-1 met wat de AI-prompt als canonical aria-label
 * voorschrijft (zie `interactive-alpine-prompt.ts` → “Mobiel menu — contrast”).
 *
 * Alleen ≤1023px zodat de desktop-variant (bij breed uitklappen) onaangeraakt blijft.
 */
export const STUDIO_MOBILE_NAV_DRAWER_FONT_CAP_CSS = `@media (max-width: 1023px) {
  /* Patroon 0 — onze eigen post-process marker \`.gentrix-push-drawer\` (zie
     \`convertMobileDrawerToPushDown\`). Dit is de betrouwbaarste hook omdat die op élke
     door de studio ge-postprocesste header zit. Utilities als \`text-2xl\`/\`text-3xl\` op
     menu-ankers worden hier teruggebracht naar normale site-navigatie-grootte. */
  .gentrix-push-drawer a,
  .gentrix-push-drawer button,
  .gentrix-push-drawer span,
  /* Patroon 1 — canonical aria-label (zoals onze AI-prompt voorschrijft). */
  [aria-label="Mobiel menu"] a,
  [aria-label="Mobile menu"] a,
  [aria-label="Mobiel menu"] button,
  [aria-label="Mobile menu"] button,
  /* Patroon 2 — bare drawer in header zonder aria-label: \`<div class="lg:hidden" x-show="navOpen">\`. */
  header [x-show][class*=":hidden"] a,
  header [x-show][class*=":hidden"] button,
  header [class*=":hidden"][x-show] a,
  header [class*=":hidden"][x-show] button,
  /* Patroon 3 — fullscreen sheet \`fixed inset-0 ... x-show\`, soms direct onder body geteleport. */
  [x-show][class*="fixed"][class*="inset-0"] a,
  [x-show][class*="fixed"][class*="inset-0"] button,
  [x-show][class*="fixed"][class*="inset-y-0"] a,
  [x-show][class*="fixed"][class*="inset-y-0"] button,
  /* Patroon 4 — drawer als directe broer/zus van een hamburger-knop in dezelfde \`x-data\`-scope. */
  header [x-data] [x-show][class*="fixed"] a,
  header [x-data] [x-show][class*="fixed"] button {
    font-size: 1rem !important;
    line-height: 1.4 !important;
  }
  /* CTA-items (knoppen / pil-spans zoals "WHATSAPP") iets compacter; ook als ze gestyled
     zijn via background-utilities zonder button-tag (zoals in MoSham: \`<span class="bg-...">\`). */
  .gentrix-push-drawer a[class*="rounded-"],
  .gentrix-push-drawer button[class*="rounded-"],
  .gentrix-push-drawer a[class*="bg-"],
  .gentrix-push-drawer button[class*="bg-"],
  .gentrix-push-drawer span[class*="bg-"],
  [aria-label="Mobiel menu"] a[class*="rounded-"],
  [aria-label="Mobile menu"] a[class*="rounded-"],
  [aria-label="Mobiel menu"] button[class*="rounded-"],
  [aria-label="Mobile menu"] button[class*="rounded-"],
  header [x-show][class*=":hidden"] a[class*="rounded-"],
  header [x-show][class*=":hidden"] button[class*="rounded-"],
  [x-show][class*="fixed"][class*="inset-0"] a[class*="rounded-"],
  [x-show][class*="fixed"][class*="inset-0"] button[class*="rounded-"] {
    font-size: 0.8125rem !important;
    line-height: 1.3 !important;
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
 * Mobiele editor-iframe mag niet horizontaal "wegschuiven"/pannen.
 * Scope strikt op `data-gentrix-studio-mobile` + iframe-flag zodat live site en desktop-preview onaangetast blijven.
 */
export const STUDIO_IFRAME_MOBILE_X_LOCK_CSS = `@media (max-width: 1023px) {
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: clip !important;
    overscroll-behavior-x: none !important;
  }
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] body {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    overscroll-behavior-x: none !important;
    touch-action: pan-y !important;
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
 *
 * **Niet** op `html[data-gentrix-studio-mobile="1"]`: daar is het iframe 768–1023px breed (smal venster / drie kolommen)
 * en verbergt `STUDIO_MOBILE_EDITOR_FRAME_NAV_CSS` al de desktop-nav — als we hier `.md:hidden` forceren,
 * verdwijnt ook de hamburger (`md:hidden`) en lijkt de navbar weg.
 */
export const STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS = `@media (min-width: 640px) {
  html[data-gentrix-studio-iframe="1"]:not([data-gentrix-studio-mobile="1"]) .sm\\:hidden {
    display: none !important;
  }
}
@media (min-width: 768px) {
  html[data-gentrix-studio-iframe="1"]:not([data-gentrix-studio-mobile="1"]) .md\\:hidden {
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
 * Declaratieve `data-studio-nav-chrome`-header: menuknop zichtbaarheid los van Tailwind-JIT purge
 * en met hogere specificiteit dan generieke iframe-desktop-fixes op `.lg:hidden`.
 */
export const STUDIO_NAV_CHROME_MENU_BTN_VISIBILITY_CSS = `@media (max-width: 1023px) {
  header[data-studio-nav-chrome="1"] button.studio-nav-chrome-menu-btn {
    display: inline-flex !important;
  }
}
@media (min-width: 1024px) {
  header[data-studio-nav-chrome="1"] button.studio-nav-chrome-menu-btn {
    display: none !important;
  }
}`;

/**
 * Alleen **mobiele** HTML-editor-preview (`data-gentrix-studio-mobile` + iframe): vaak halftransparante
 * `nav` / sheet over de hero — hier **volledig dekkend** (geen hero-titel erdoorheen), alleen in deze preview.
 */
export const STUDIO_IFRAME_MOBILE_EDITOR_NAV_SHEET_CSS = `@media (max-width: 1023px) {
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header nav,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header [role="navigation"] {
    background-color: rgb(15 23 42) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header #site-mobile-sheet {
    background: rgb(15 23 42) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="fixed"].flex-col,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="absolute"].flex-col,
  html[data-gentrix-studio-mobile="1"][data-gentrix-studio-iframe="1"] header > div[class*="inset-0"].flex {
    background-color: rgb(15 23 42) !important;
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
  /* will-change via JS gezet net vóór de IO triggert (zie STUDIO_SCROLL_REVEAL_SCRIPT);
     hier alleen de reset: na de transitie geen actieve compositor layer meer nodig. */
  [data-animation].studio-in-view {
    will-change: auto;
  }
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
 * + STUDIO_SCROLL_REVEAL_SCRIPT + STUDIO_SCROLL_BORDER_* + STUDIO_NAV_SCROLL_CONTRAST_* (sticky nav op lichte achtergrond).
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
 * Legacy horizontale ticker-CSS (niet meer in prompts/generator); behouden voor oudere gepubliceerde HTML.
 * Markup was: buitenste `div.studio-marquee` + `div.studio-marquee-track` met dubbele inhoud; snelheid via
 * `studio-marquee--slow` / `studio-marquee--fast` op de track.
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
      var idx=Math.min(counts[k]-1,5);
      el.style.setProperty("--studio-stagger",(idx*50)+"ms");
    }
    /* Pre-warm IO: promoveer compositor layers 25% vóór viewport zodat will-change
       al klaar is als het element écht zichtbaar wordt. Doet alleen will-change, geen klasse. */
    var preWarm=new IntersectionObserver(function(ents){
      for(var p=0;p<ents.length;p++){
        var pe=ents[p];
        if(!pe.isIntersecting)continue;
        try{pe.target.style.willChange='opacity,transform';}catch(_){}
        preWarm.unobserve(pe.target);
      }
    },{root:null,rootMargin:"0px 0px 25% 0px",threshold:0.01});
    var io=new IntersectionObserver(function(ents){
      for(var j=0;j<ents.length;j++){
        var e=ents[j];
        if(!e.isIntersecting)continue;
        e.target.classList.add("studio-in-view");
        io.unobserve(e.target);
      }
    },{root:null,rootMargin:"0px 0px 8% 0px",threshold:0.01});
    for(var n=0;n<nodes.length;n++){io.observe(nodes[n]);preWarm.observe(nodes[n]);}
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
 * Volledige kaderrand (SVG-stroke) waarvan het **zichtbare deel** meeloopt met **document-scroll**:
 * start **75%** van de omtrek (pad start linksonder, met de klok mee), eindigt op **100%** onderaan de pagina.
 * **Geen** standaardkleur: zonder geldige `--studio-sb-stroke` op dezelfde wrapper tekent het script niets.
 *
 * Markup: wrapper met `data-studio-scroll-border` + `style="--studio-sb-stroke:#…"` (of `rgb(…)`); `position`/`isolation` zit in bundel-CSS.
 * Inhoud als directe kinderen krijgt automatisch `z-index:1` boven de SVG.
 * Optioneel: `--studio-sb-width` (px, default 2). `data-studio-scroll-border="0"` schakelt één instance uit.
 */
export const STUDIO_SCROLL_BORDER_CSS = `/* SVG-kader: stroke wordt door script gezet; pointer-events blijven op inhoud */
[data-studio-scroll-border] {
  position: relative;
  isolation: isolate;
}
.studio-scroll-border__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: visible;
}
[data-studio-scroll-border] > *:not(.studio-scroll-border__svg) {
  position: relative;
  z-index: 1;
}`;

/** Zie STUDIO_SCROLL_BORDER_CSS — `data-gentrix-static-scroll-border="1"` = altijd 100% rand (geen scroll-koppeling). */
export const STUDIO_SCROLL_BORDER_SCRIPT = `<script>
(function(){
  function strokeVar(el){
    return getComputedStyle(el).getPropertyValue("--studio-sb-stroke").trim();
  }
  function strokeW(el){
    var w=parseFloat(getComputedStyle(el).getPropertyValue("--studio-sb-width"));
    return isFinite(w)&&w>0?w:2;
  }
  function pathD(w,h,sw){
    var i=sw/2;
    return "M "+i+" "+(h-i)+" L "+(w-i)+" "+(h-i)+" L "+(w-i)+" "+i+" L "+i+" "+i+" Z";
  }
  function perim(w,h,sw){
    return Math.max(0,2*(w+h-2*sw));
  }
  function scrollT(){
    var r=document.documentElement;
    var max=Math.max(1,r.scrollHeight-r.clientHeight);
    return Math.min(1,Math.max(0,r.scrollTop/max));
  }
  function bootOne(host){
    if(host.getAttribute("data-studio-scroll-border")==="0")return;
    if(!strokeVar(host))return;
    var staticMode=document.documentElement.getAttribute("data-gentrix-static-scroll-border")==="1";
    var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var svg=host.querySelector(".studio-scroll-border__svg");
    if(!svg||svg.namespaceURI!=="http://www.w3.org/2000/svg"){
      svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("class","studio-scroll-border__svg");
      svg.setAttribute("aria-hidden","true");
      svg.setAttribute("focusable","false");
      host.insertBefore(svg,host.firstChild);
    }
    var pathEl=svg.querySelector("path");
    if(!pathEl){
      pathEl=document.createElementNS("http://www.w3.org/2000/svg","path");
      pathEl.setAttribute("fill","none");
      pathEl.setAttribute("stroke-linejoin","miter");
      pathEl.setAttribute("stroke-linecap","butt");
      svg.appendChild(pathEl);
    }
    function paint(){
      var sw=strokeW(host);
      var col=strokeVar(host);
      if(!col){svg.style.display="none";return;}
      svg.style.display="";
      var rw=host.clientWidth;
      var rh=host.clientHeight;
      if(rw<4||rh<4)return;
      svg.setAttribute("viewBox","0 0 "+rw+" "+rh);
      svg.setAttribute("preserveAspectRatio","none");
      pathEl.setAttribute("d",pathD(rw,rh,sw));
      pathEl.setAttribute("stroke",col);
      pathEl.setAttribute("stroke-width",String(sw));
      pathEl.setAttribute("vector-effect","non-scaling-stroke");
      var P=perim(rw,rh,sw);
      if(P<=0)return;
      var t=staticMode||reduce?1:scrollT();
      var frac=0.75+0.25*t;
      var L=P*frac;
      pathEl.setAttribute("stroke-dasharray",L+" "+(P*2));
      pathEl.setAttribute("stroke-dashoffset","0");
    }
    paint();
    window.addEventListener("resize",paint,{passive:true});
    if(!(staticMode||reduce))window.addEventListener("scroll",paint,{passive:true});
    if(typeof ResizeObserver!=="undefined"){
      var ro=new ResizeObserver(function(){paint();});
      ro.observe(host);
    }
  }
  function boot(){
    var hosts=document.querySelectorAll("[data-studio-scroll-border]");
    for(var i=0;i<hosts.length;i++)bootOne(hosts[i]);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
</script>`;

/**
 * Sticky/fixed top-nav: bemonster wat visueel **achter** de balk ligt; bij lichte achtergrond
 * `.studio-nav-tone-light` voor donkere voorgrond (studio-preview + live site + export).
 * Let op: `behindNav`/`bgLum` mogen **niet** op helderheid `1` vallen bij “geen sample” — dat zette
 * ten onrechte donkere menu-tekst op **donkere** headers (onleesbare navbar).
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
/*
 * Hamburger / sluit-icoon: veel templates gebruiken drie <span class="… bg-white …">-streepjes
 * voor donkere headers. STUDIO_NAV_SCROLL_CONTRAST_SCRIPT zet dan .studio-nav-tone-light op de
 * header (licht beeld erachter) — tekst wordt donker, maar bg-white op de streepjes bleef wit:
 * wit op wit / bijna wit = “ontbrekende” menuknop op mobiel.
 */
header.studio-nav-tone-light button span[class*="bg-white"],
nav.studio-nav-tone-light button span[class*="bg-white"] {
  background-color: var(--studio-nav-auto-fg) !important;
}
/*
 * .studio-nav-tone-light zet de hele <header> op donkere voorgrond voor contrast op lichte hero’s.
 * Mobiele sheets/drawers zitten DOM-gewijs in de header maar zijn vrijwel altijd donker — dan worden
 * Lucide-sluiticonen (stroke currentColor) en links onzichtbaar. Zet dit vlak expliciet terug naar licht.
 */
header.studio-nav-tone-light :is(nav[aria-label="Mobiel menu"], nav[aria-label="Mobile menu"], div[aria-label="Mobiel menu"], div[aria-label="Mobile menu"], #site-mobile-sheet) :is(a, button, span, li, label) {
  color: rgb(248 250 252) !important;
}
header.studio-nav-tone-light :is(nav[aria-label="Mobiel menu"], nav[aria-label="Mobile menu"], div[aria-label="Mobiel menu"], div[aria-label="Mobile menu"], #site-mobile-sheet) svg {
  color: rgb(248 250 252) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}
/* Menutoggle met expliciet wit (hamburger ↔ X) boven donkere hero: niet overschrijven met tone-light. */
header.studio-nav-tone-light button.text-white,
header.studio-nav-tone-light button[class*="text-white"] {
  color: rgb(248 250 252) !important;
}
header.studio-nav-tone-light button.text-white svg,
header.studio-nav-tone-light button[class*="text-white"] svg {
  color: rgb(248 250 252) !important;
  fill: currentColor !important;
  stroke: currentColor !important;
}
/*
 * Alleen expliciet gemarkeerde GENTRIX primary nav:
 * - top van pagina: transparant (geen witte balk over hero)
 * - na scroll: subtiele frosted laag voor leesbaarheid
 */
html[data-gentrix-scroll-nav-fallback="1"] {
  overflow-x: hidden !important;
  overscroll-behavior-x: none !important;
}
html[data-gentrix-scroll-nav-fallback="1"] body {
  overflow-x: hidden !important;
  overscroll-behavior-x: none !important;
  width: 100% !important;
  max-width: 100% !important;
  touch-action: pan-y !important;
}
/*
 * Gentrix-home mobiele hero: sommige AI-runs zetten een halve gradient-overlay
 * over de achtergrond. Dat geeft een harde verticale lijn en kan horizontaal pannen triggeren.
 * Forceer die overlays full-bleed op de eerste hero-zone.
 */
html[data-gentrix-scroll-nav-fallback="1"] section#hero [class*="absolute"][class*="bg-gradient"][class*="w-1/2"],
html[data-gentrix-scroll-nav-fallback="1"] #hero [class*="absolute"][class*="bg-gradient"][class*="w-1/2"],
html[data-gentrix-scroll-nav-fallback="1"] body > section:first-of-type [class*="absolute"][class*="bg-gradient"][class*="w-1/2"],
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > section:first-of-type [class*="absolute"][class*="bg-gradient"][class*="w-1/2"] {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  max-width: none !important;
}
html[data-gentrix-scroll-nav-fallback="1"] section#hero,
html[data-gentrix-scroll-nav-fallback="1"] #hero,
html[data-gentrix-scroll-nav-fallback="1"] body > section:first-of-type,
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > section:first-of-type {
  overflow-x: clip !important;
}
header[data-gentrix-scroll-nav="1"]:not([data-studio-nav-chrome]),
nav[data-gentrix-scroll-nav="1"] {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 90 !important;
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transition:
    background-color 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    backdrop-filter 220ms ease,
    -webkit-backdrop-filter 220ms ease;
}
html[data-gentrix-scroll-nav-fallback="1"] header[class*="sticky"][class*="top-0"]:not([data-gentrix-scrolled="1"]):not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] header[class*="fixed"][class*="top-0"]:not([data-gentrix-scrolled="1"]):not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] nav[class*="sticky"][class*="top-0"]:not([data-gentrix-scrolled="1"]),
html[data-gentrix-scroll-nav-fallback="1"] nav[class*="fixed"][class*="top-0"]:not([data-gentrix-scrolled="1"]) {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 90 !important;
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html[data-gentrix-scroll-nav-fallback="1"] body > header:first-of-type:not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] body > nav:first-of-type,
html[data-gentrix-scroll-nav-fallback="1"] body > section:first-of-type > header:first-of-type:not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] body > section:first-of-type > nav:first-of-type,
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > header:first-of-type:not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > nav:first-of-type,
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > section:first-of-type > header:first-of-type:not([data-studio-nav-chrome]),
html[data-gentrix-scroll-nav-fallback="1"] .gentrix-published-root > section:first-of-type > nav:first-of-type {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  z-index: 90 !important;
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
/*
 * Bovenaan (niet gescrold): alle directe kinderen transparant — niet alleen .mx-auto.
 * Anders: logo-rail met eigen bg-slate-* naast een leeggemaakte .mx-auto-rail = twee kleurvlakken.
 */
header[data-gentrix-scroll-nav="1"]:not([data-studio-nav-chrome]):not([data-gentrix-scrolled="1"]) > *,
nav[data-gentrix-scroll-nav="1"]:not([data-gentrix-scrolled="1"]) > * {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]),
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"],
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]),
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] {
  background-color: rgb(8 16 34 / 0.44) !important;
  border-color: rgb(148 163 184 / 0.22) !important;
  box-shadow: 0 8px 22px rgba(2, 6, 23, 0.2) !important;
  backdrop-filter: blur(12px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(130%) !important;
}
/*
 * Gescrold: één frosted laag op de header — kinderen transparant (geen dubbele blur / geen halve balk donkerder).
 */
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) > *,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] > *,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) > *,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] > * {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) a,
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) button,
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) span,
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) li,
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) label,
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) svg,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] a,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] button,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] span,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] li,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] label,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] svg,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) a,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) button,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) span,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) li,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) label,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) svg,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] a,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] button,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] span,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] li,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] label,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] svg {
  color: rgb(241 245 249) !important;
}
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) svg,
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] svg,
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) svg,
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] svg {
  fill: currentColor !important;
  stroke: currentColor !important;
}
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) [class*="border-white"],
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] [class*="border-white"],
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) [class*="border-white"],
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] [class*="border-white"] {
  border-color: rgba(241, 245, 249, 0.28) !important;
}
header[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) button span[class*="bg-white"],
nav[data-gentrix-scroll-nav="1"][data-gentrix-scrolled="1"] button span[class*="bg-white"],
header[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"]:not([data-studio-nav-chrome]) button span[class*="bg-white"],
nav[data-gentrix-scroll-overlay="1"][data-gentrix-scrolled="1"] button span[class*="bg-white"] {
  background-color: rgb(241 245 249) !important;
}
`;

/**
 * Bibliotheek: transparant → frosted/donker bij scroll. Model zet \`studio-nav-scroll-dim\` op de host en
 * Alpine toggelt \`studio-nav-scroll-dim--active\` (zie \`getStudioNavChromePatternLibraryPromptBlock\`).
 */
export const STUDIO_NAV_SCROLL_DIM_CSS = `/* studio-nav-scroll-dim: zie lib/ai/studio-nav-chrome-pattern-library.ts */
header.studio-nav-scroll-dim,
nav.studio-nav-scroll-dim {
  transition:
    background-color 220ms ease,
    border-color 220ms ease,
    box-shadow 220ms ease,
    backdrop-filter 220ms ease,
    -webkit-backdrop-filter 220ms ease;
}
@media (prefers-reduced-motion: reduce) {
  header.studio-nav-scroll-dim,
  nav.studio-nav-scroll-dim {
    transition: none;
  }
}
header.studio-nav-scroll-dim:not(.studio-nav-scroll-dim--active),
nav.studio-nav-scroll-dim:not(.studio-nav-scroll-dim--active) {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
header.studio-nav-scroll-dim:not(.studio-nav-scroll-dim--active) > *,
nav.studio-nav-scroll-dim:not(.studio-nav-scroll-dim--active) > * {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active {
  background-color: rgb(8 16 34 / 0.5) !important;
  border-color: rgb(148 163 184 / 0.24) !important;
  box-shadow: 0 10px 28px rgba(2, 6, 23, 0.22) !important;
  backdrop-filter: blur(14px) saturate(135%) !important;
  -webkit-backdrop-filter: blur(14px) saturate(135%) !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active > *,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active > * {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active a,
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active button,
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active span,
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active li,
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active label,
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active svg,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active a,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active button,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active span,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active li,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active label,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active svg {
  color: rgb(241 245 249) !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active svg,
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active svg {
  fill: currentColor !important;
  stroke: currentColor !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active [class*="border-white"],
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active [class*="border-white"] {
  border-color: rgba(241, 245, 249, 0.28) !important;
}
header.studio-nav-scroll-dim.studio-nav-scroll-dim--active button span[class*="bg-white"],
nav.studio-nav-scroll-dim.studio-nav-scroll-dim--active button span[class*="bg-white"] {
  background-color: rgb(241 245 249) !important;
}
`;

/**
 * iOS Safari iframe position:fixed fix — zonder dit verschijnt het mobiele nav-overlay als een klein kaartje
 * i.p.v. volledig scherm te bedekken. Scroll-lock op <html> wanneer een nav-toggle truthy wordt, zodat
 * position:fixed elementen relatief aan het viewport renderen in plaats van de iframe-scrollcontainer.
 * Checkt alle Alpine nav-toggle sleutels (ALPINE_NAV_TOGGLE_KEYS) op elk x-data element.
 */
export function buildStudioIosNavFixScript(): string {
  const keysLiteral = ALPINE_NAV_TOGGLE_KEYS.map((k) => JSON.stringify(k)).join(",");
  return `<script>
(function(){
  if(!/iP(?:hone|ad|od)/.test(navigator.userAgent)&&!(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform)))return;
  var KEYS=[${keysLiteral}];
  var _savedY=0;
  /* Scroll-lock: body position:fixed met top=-scrollY zodat de pagina visueel op dezelfde plek blijft.
     Bij sluiten: stijl verwijderen + window.scrollTo herstelt exact de positie.
     Zonder deze correctie springt iOS terug naar de bovenkant en triggert de IO voor elke sectie
     die snel "gepasseerd" wordt, wat de "hangt elk stuk vast"-jank veroorzaakt. */
  function iosl(on){
    try{
      if(on){
        _savedY=window.scrollY||window.pageYOffset||document.documentElement.scrollTop||0;
        document.body.style.cssText='overflow:hidden;position:fixed;top:-'+_savedY+'px;left:0;right:0;width:100%;';
      }else{
        document.body.style.cssText='';
        try{window.scrollTo(0,_savedY);}catch(_r){}
      }
    }catch(_){}
  }
  function scope(el){try{if(window.Alpine&&typeof Alpine.$data==='function')return Alpine.$data(el);}catch(_){}return el._x_dataStack&&el._x_dataStack[0];}
  document.addEventListener('alpine:initialized',function(){
    try{
      document.querySelectorAll('[x-data]').forEach(function(el){
        var d=scope(el);
        if(!d)return;
        if(typeof d._il==='function')return;
        var k=KEYS.find(function(k){return typeof d[k]!=='undefined';});
        if(!k)return;
        Alpine.effect(function(){iosl(!!scope(el)[k]);});
      });
    }catch(_){}
  });
})();
</script>`;
}

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
    return null;
  }
  function behindNav(nav,x,y){
    var stack=document.elementsFromPoint(x,y);
    for(var i=0;i<stack.length;i++){
      var el=stack[i];
      if(nav.contains(el))continue;
      return bgLum(el);
    }
    return null;
  }
  function pickNav(){
    var list=document.querySelectorAll("header,nav");
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(el.closest("[data-studio-skip-nav-tone]"))continue;
      if(el.getAttribute&&el.getAttribute("data-studio-nav-chrome")==="1")continue;
      var st=getComputedStyle(el);
      if(st.position!=="fixed"&&st.position!=="sticky")continue;
      if(st.display==="none"||st.visibility==="hidden")continue;
      var op=parseFloat(st.opacity||"1");
      if(!isNaN(op)&&op<0.06)continue;
      var r=el.getBoundingClientRect();
      if(r.top>innerHeight*0.42)continue;
      if(r.height>innerHeight*0.55)continue;
      if(r.width<Math.max(240,innerWidth*0.45))continue;
      return el;
    }
    return null;
  }
  /**
   * Bestaande / oudere home-output heeft nog geen expliciete marker.
   * Op Gentrix-home staan we dit toe als fallback zodat gedrag meteen zichtbaar is zonder hergeneratie.
   */
  function shouldTreatAsGentrixScrollNavTarget(el){
    if(!el)return false;
    if(el.getAttribute&&el.getAttribute("data-studio-nav-chrome")==="1")return false;
    if(el.getAttribute&&el.getAttribute("data-gentrix-scroll-nav")==="1")return true;
    if(el.getAttribute&&el.getAttribute("data-gentrix-scroll-overlay")==="1")return true;
    var root=document.documentElement;
    if(!(root&&root.getAttribute&&root.getAttribute("data-gentrix-scroll-nav-fallback")==="1"))return false;
    var roleOk=(el.tagName==="HEADER"||el.tagName==="NAV");
    if(!roleOk)return false;
    var st=getComputedStyle(el);
    if(st.position!=="sticky"&&st.position!=="fixed")return false;
    if(st.display==="none"||st.visibility==="hidden")return false;
    var op=parseFloat(st.opacity||"1");
    if(!isNaN(op)&&op<0.06)return false;
    var r=el.getBoundingClientRect();
    if(r.top<-24||r.top>Math.max(20,innerHeight*0.2)||r.height<28||r.height>Math.max(220,innerHeight*0.65))return false;
    if(r.width<Math.max(240,innerWidth*0.45))return false;
    return true;
  }
  function fallbackGentrixNavCandidate(){
    var root=document.documentElement;
    if(!(root&&root.getAttribute&&root.getAttribute("data-gentrix-scroll-nav-fallback")==="1"))return null;
    var list=document.querySelectorAll("header,nav");
    for(var i=0;i<list.length;i++){
      var el=list[i];
      if(!shouldTreatAsGentrixScrollNavTarget(el))continue;
      return el;
    }
    var hard=document.querySelector(
      "body > header:first-of-type, body > nav:first-of-type, body > section:first-of-type > header:first-of-type, body > section:first-of-type > nav:first-of-type," +
      ".gentrix-published-root > header:first-of-type, .gentrix-published-root > nav:first-of-type, .gentrix-published-root > section:first-of-type > header:first-of-type, .gentrix-published-root > section:first-of-type > nav:first-of-type"
    );
    if(hard&&hard.tagName&&shouldTreatAsGentrixScrollNavTarget(hard)){
      return hard;
    }
    return null;
  }
  var nav=null,ticking=false,THRESH=0.57,NAV_DARK_CAP=0.42,scrollIdleTimer=0;
  function setGentrixScrolling(active){
    if(!nav||!shouldTreatAsGentrixScrollNavTarget(nav))return;
    nav.setAttribute("data-gentrix-scrolling",active?"1":"0");
  }
  function touchGentrixScrolling(){
    setGentrixScrolling(true);
    if(scrollIdleTimer)clearTimeout(scrollIdleTimer);
    scrollIdleTimer=setTimeout(function(){setGentrixScrolling(false);},520);
  }
  function syncGentrixScrollNavState(){
    if(!nav)return;
    if(nav.getAttribute&&nav.getAttribute("data-studio-nav-chrome")==="1")return;
    if(!shouldTreatAsGentrixScrollNavTarget(nav))return;
    if(nav.getAttribute&&nav.getAttribute("data-gentrix-scroll-nav")!=="1"){
      nav.setAttribute("data-gentrix-scroll-nav","1");
    }
    if(nav.getAttribute&&nav.getAttribute("data-gentrix-scroll-overlay")!=="1"){
      nav.setAttribute("data-gentrix-scroll-overlay","1");
    }
    if(nav.getAttribute&&nav.getAttribute("data-gentrix-scrolling")==null){
      nav.setAttribute("data-gentrix-scrolling","0");
    }
    var sc=((window.pageYOffset||document.documentElement.scrollTop||document.body.scrollTop||0)>8);
    nav.setAttribute("data-gentrix-scrolled",sc?"1":"0");
    if(!sc)setGentrixScrolling(false);
  }
  function sync(){
    if(!nav)return;
    if(nav.getAttribute&&nav.getAttribute("data-studio-nav-chrome")==="1")return;
    syncGentrixScrollNavState();
    var r=nav.getBoundingClientRect();
    if(r.height<20||r.width<32)return;
    var navSelf=bgLum(nav);
    if(navSelf!=null&&navSelf<NAV_DARK_CAP){
      nav.classList.remove("studio-nav-tone-light");
      return;
    }
    var x1=Math.min(Math.max(innerWidth*0.22,6),innerWidth-6);
    var x2=Math.min(Math.max(innerWidth*0.5,6),innerWidth-6);
    var x3=Math.min(Math.max(innerWidth*0.78,6),innerWidth-6);
    var py=Math.min(Math.max(r.top+r.height*0.5,2),innerHeight-3);
    var s1=behindNav(nav,x1,py),s2=behindNav(nav,x2,py),s3=behindNav(nav,x3,py);
    var samples=[];
    if(s1!=null)samples.push(s1);
    if(s2!=null)samples.push(s2);
    if(s3!=null)samples.push(s3);
    if(!samples.length){
      if(navSelf!=null&&navSelf>${STUDIO_NAV_SELF_SURFACE_LIGHT_LUM}){
        nav.classList.add("studio-nav-tone-light");
      }else{
        nav.classList.remove("studio-nav-tone-light");
      }
      return;
    }
    var L=Math.max.apply(Math,samples);
    var useLightChrome=(L>THRESH);
    if(navSelf!=null&&navSelf>${STUDIO_NAV_SELF_SURFACE_LIGHT_LUM})useLightChrome=true;
    nav.classList.toggle("studio-nav-tone-light",useLightChrome);
  }
  function onTick(){
    touchGentrixScrolling();
    if(ticking)return;
    ticking=true;
    requestAnimationFrame(function(){
      ticking=false;
      sync();
    });
  }
  function boot(){
    nav=pickNav();
    if(!nav||!shouldTreatAsGentrixScrollNavTarget(nav)){
      var fb=fallbackGentrixNavCandidate();
      if(fb)nav=fb;
    }
    if(!nav)return;
    var alreadyMark=nav.getAttribute&&nav.getAttribute("data-gentrix-scroll-nav")==="1";
    var fbActive=document.documentElement.getAttribute&&document.documentElement.getAttribute("data-gentrix-scroll-nav-fallback")==="1";
    if(!alreadyMark&&!fbActive)return;
    if(nav.getAttribute&&nav.getAttribute("data-gentrix-scroll-overlay")!=="1"){
      nav.setAttribute("data-gentrix-scroll-overlay","1");
    }
    syncGentrixScrollNavState();
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

/**
 * Veel gegenereerde hero's wrappen de primaire `<header class="sticky …">` in `overflow-hidden` (Tailwind),
 * soms ook de buitenste `section[data-section]`-wrapper. Dan is de scroll-container die sectie i.p.v. de
 * viewport — de balk scrollt mee tot het einde van de hero. Zet overflow op `visible` op alle ancestors
 * tot en met de eerste `section[data-section]` (daar stoppen we; verder omhoog niet aanpassen).
 */
export const STUDIO_STICKY_NAV_OVERFLOW_FIX_SCRIPT = `<script>
(function(){
  function truncates(ax,ay){
    return (ax!=="visible"&&ax!=="clip")||(ay!=="visible"&&ay!=="clip");
  }
  function fixOnce(){
    try{
      var root=document.querySelector("section[data-section]");
      if(!root)return;
      var hdr=root.querySelector("header[data-studio-nav-chrome]");
      if(!hdr)hdr=root.querySelector("header[class*='sticky']");
      if(!hdr)return;
      var cur=hdr.parentElement;
      while(cur&&cur!==document.body){
        var st=window.getComputedStyle(cur);
        if(truncates(st.overflowX,st.overflowY)){
          cur.style.setProperty("overflow","visible","important");
        }
        /* Stop ná overflow-fix: eerste section[data-section]-wrapper had soms zelf overflow-hidden;
         * eerder braken we vóór de fix → sticky werkte alleen tot einde hero. */
        if(cur.matches&&cur.matches("section[data-section]"))break;
        cur=cur.parentElement;
      }
    }catch(_){}
  }
  function boot(){
    fixOnce();
    setTimeout(fixOnce,120);
    setTimeout(fixOnce,600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
  var rt;
  window.addEventListener("resize",function(){
    clearTimeout(rt);
    rt=setTimeout(fixOnce,100);
  },{passive:true});
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
  return replaceAllOpenTagsByLocalName(html, "img", (tag) => {
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
  return replaceAllOpenTagsByLocalName(html, "img", (full) => {
    if (/\bonerror\s*=/i.test(full)) return full;
    let body = full.replace(/^<img\b/i, "").trim();
    if (body.endsWith("/>")) body = body.slice(0, -2).trim();
    else if (body.endsWith(">")) body = body.slice(0, -1).trim();
    return `<img${body ? ` ${body}` : ""} onerror="this.remove()">`;
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
      ensureAlpineMobileToggleButtonHasLgHidden(
        repairBrokenMobileDrawer(fixAlpineNavToggleDefaultsInXData(normalizeStudioHeroDomIdsAndRootMotion(html))),
      ),
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
      "srcset",
      "sizes",
      "loading",
      "fetchpriority",
      "decoding",
      "crossorigin",
      "referrerpolicy",
      /** AI-hero inject (`lib/ai/ai-hero-image-postprocess.ts`); expliciet — ALLOW_DATA_ATTR is false. */
      "data-gentrix-ai-hero-img",
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
      /** SVG `<line>` (o.a. hamburger in `buildGentrixMenuIconToggle`) — zonder deze attrs zijn de strepen leeg. */
      "x1",
      "y1",
      "x2",
      "y2",
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
      "stroke-dasharray",
      "stroke-dashoffset",
      "pathLength",
      "pathlength",
      "vector-effect",
      "preserveAspectRatio",
      "focusable",
      "data-studio-scroll-border",
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
      /** Gentrix scroll-nav chrome (declaratieve header); anders strip DOMPurify `data-gentrix-*` weg. */
      "data-gentrix-scroll-nav",
      "data-gentrix-scrolled",
      "data-gentrix-scroll-overlay",
      "data-gentrix-scrolling",
      "data-studio-nav-chrome",
      /** Ankers / secties in client-HTML. */
      "data-section",
      /** Portal visuele editor: section wrappers moeten de sanitizer overleven. */
      "data-portal-section-key",
      "data-portal-section-name",
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
return removeDuplicateAlpineNavScopeInHeader(
  repairBrokenMobileDrawer(
    appendImgOnErrorHide(
      convertMobileDrawerToPushDown(alignChromeNavMdLgBreakpoints(repairHeaderMobileMenuButton(purified))),
    ),
  ),
);
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

function tailwindRadiusBodyClass(input: string): string {
  const t = input.trim();
  if (/^rounded(-[a-z0-9]+)?$/.test(t)) return ` ${t}`;
  return "";
}

export function buildRootCssVarsForTailwindPage(pageConfig: TailwindPageConfig | null | undefined): {
  fontHeadFragment: string;
  fontStack: string;
  rootCss: string;
  radiusClass: string;
} {
  if (!pageConfig) {
    const fontStack = "Inter, system-ui, sans-serif";
    return {
      fontHeadFragment: buildStudioFontHeadFragment({ fontStack }),
      fontStack,
      rootCss: "",
      radiusClass: "",
    };
  }

  if (isLegacyTailwindPageConfig(pageConfig)) {
    const fontStack = sanitizeFontStackForPage(pageConfig.fontFamily);
    const primary = sanitizeCssHex(pageConfig.primaryColor);
    return {
      fontHeadFragment: buildStudioFontHeadFragment({ fontStack }),
      fontStack,
      rootCss: `:root { --page-primary: ${primary}; }`,
      radiusClass: tailwindRadiusBodyClass(pageConfig.borderRadius),
    };
  }

  const { theme, font } = pageConfig;
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

  const fontStack = sanitizeFontStackForPage(font);
  return {
    fontHeadFragment: buildStudioFontHeadFragment({ fontStack }),
    fontStack,
    rootCss: `:root {
    ${cssVarLines.join(";\n    ")};
  }`,
    radiusClass: "",
  };
}

/**
 * `<link rel="icon">` voor geëxporteerde HTML en iframe-srcDoc.
 * Premium `logoSet.variants.favicon` wint; anders deterministische site-identiteit (kleur + teken).
 */
export function buildFaviconLinkTagForPublishedSite(input: {
  logoSet?: GeneratedLogoSet | null;
  displayName: string;
  slug: string;
  pageConfig?: TailwindPageConfig | null;
  themePrimaryHex?: string | null;
}): string {
  const svg = resolvePublicSiteFaviconSvg({
    logoFavicon: input.logoSet?.variants?.favicon,
    displayName: input.displayName,
    slug: input.slug,
    pageConfig: input.pageConfig ?? null,
    themePrimaryHex: input.themePrimaryHex ?? null,
  });
  const safe =
    svg.length <= MAX_FAVICON_DATA_URL_CHARS
      ? svg
      : resolvePublicSiteFaviconSvg({
          logoFavicon: undefined,
          displayName: "G",
          slug: "g",
          pageConfig: null,
          themePrimaryHex: "#4f46e5",
        });
  return `<link rel="icon" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(safe)}" type="image/svg+xml"/>`;
}

export type BuildTailwindSectionsBodyOptions = {
  logoSet?: GeneratedLogoSet | null;
  /** Optioneel: server kiest nav-preset i.f.m. Denklijn-contract (infer zonder `navVisualPreset`). */
  designContract?: DesignGenerationContract | null;
};

export function buildTailwindSectionsBodyInnerHtml(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
  bodyOptions?: BuildTailwindSectionsBodyOptions,
): string {
  let sectionRows: TailwindSection[] = sections;
  const shellResolve =
    pageConfig && !isLegacyTailwindPageConfig(pageConfig)
      ? resolveStudioNavUnderShellPolicy(pageConfig, sections)
      : null;

  if (shellResolve?.mode === "shell" && !shellResolve.ok) {
    throw new Error(shellResolve.errors.join(" "));
  }
  if (shellResolve?.mode === "shell" && shellResolve.ok) {
    for (const w of shellResolve.warnings) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[studioShellNav] ${w}`);
      }
    }
  }

  const studioNav =
    shellResolve?.mode === "shell" && shellResolve.ok
      ? shellResolve.studioNav
      : pageConfig && !isLegacyTailwindPageConfig(pageConfig)
        ? (parseStudioNavChromeConfig(pageConfig.studioNav) ?? inferStudioNavChromeFromSections(sections))
        : null;
  if (studioNav) {
    const navTheme = pageConfig && !isLegacyTailwindPageConfig(pageConfig) ? pageConfig.theme : null;
    sectionRows = prependStudioNavChromeToFirstSection(
      sections,
      renderStudioNavChromeHtml(studioNav, navTheme, bodyOptions?.designContract ?? null),
    );
  }

  const prepared =
    bodyOptions?.logoSet != null
      ? applyBrandLogoFallbackToSections(sectionRows, bodyOptions.logoSet)
      : sectionRows;
  return prepared
    .map((s) => {
      const portalKeyMatch = s.html.match(/\bdata-portal-section-key="([^"]*)"/i);
      const portalNameMatch = s.html.match(/\bdata-portal-section-name="([^"]*)"/i);
      if (!portalKeyMatch) {
        return `<section data-section="${escapeDataAttr(s.sectionName)}" class="w-full">${sanitizeTailwindFragment(s.html)}</section>`;
      }

      const portalKey = portalKeyMatch[1];
      const portalName = portalNameMatch?.[1] ?? "";
      const firstTagEnd = s.html.indexOf(">") + 1;
      const lastDivClose = s.html.lastIndexOf("</div>");
      const innerHtml = s.html.slice(firstTagEnd, lastDivClose > firstTagEnd ? lastDivClose : s.html.length);
      const sanitizedInner = sanitizeTailwindFragment(innerHtml);
      const portalNameAttr = portalName ? ` data-portal-section-name="${portalName}"` : "";

      return `<section data-section="${escapeDataAttr(s.sectionName)}" class="w-full"><div data-portal-section-key="${portalKey}"${portalNameAttr}>${sanitizedInner}</div></section>`;
    })
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
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){setTimeout(measure,0);});
  setTimeout(measure,200);
  setTimeout(measure,800);
  setTimeout(measure,2e3);
})();
</script>`;

/** `source: gentrix-iframe-analytics` — overeen met `lib/analytics/iframe-messages.ts` (portaal site-preview-iframe). */
const GENTRIX_IFRAME_ANALYTICS_SCRIPT = `<script>
(function(){
  var SRC="gentrix-iframe-analytics";
  function gtx(m){try{if(window.parent!==window)window.parent.postMessage(Object.assign({source:SRC},m),"*");}catch(e){}}
  gtx({type:"gentrix_iframe_ready",page_path:location.pathname+location.search});
  var done={};
  function tick(){
    var el=document.documentElement,b=document.body,sh=Math.max(b?b.scrollHeight:0,el.scrollHeight,1);
    var st=window.scrollY||el.scrollTop||0;
    var vh=window.innerHeight;
    var atBottom=st+vh>=sh-8;
    var p=Math.min(100,Math.floor(((st+vh)/sh)*100));
    var ps=[25,50,75,100];
    for(var i=0;i<ps.length;i++){
      var m=ps[i];
      if(done[m])continue;
      if(p>=m||(m===100&&atBottom)){
        done[m]=1;
        gtx({type:"gentrix_site_scroll",depth_pct:m,page_path:location.pathname+location.search});
      }
    }
  }
  var r=0;
  function onSc(){if(r)return;r=requestAnimationFrame(function(){r=0;tick();});}
  window.addEventListener("scroll",onSc,{passive:true});
  window.addEventListener("resize",onSc,{passive:true});
  if(document.readyState==="complete")tick();
  else window.addEventListener("load",function(){tick();});
})();
</script>`;

/**
 * Gegenereerde one-pagers gebruiken vaak `href="/diensten"` of **absolute** `https://host/site/slug#x`
 * i.p.v. `#sectie`. In een `srcDoc`-iframe laadt dat de **hele Next-pagina opnieuw in de iframe**
 * (geneste iframe → miniatuur in de hoek). Vang dat af: zelfde-document scroll op hash/`data-section`,
 * of blokkeer host-navigatie. **Uitzondering:** `/site/{slug}/{subroute}` (contact, marketingpagina) is een echte
 * Next-route — dan `navigateTop` (postMessage naar parent / top) i.p.v. scrollen in de iframe.
 * Links naar app-shell (`/portal/*`, `/admin`, `/login`, `/home`, `/dashboard`) en naar
 * `/boek/*`, `/booking-app/book/*` en `/boek-venster/*`: **postMessage** naar parent → modal met iframe (geen volledige tab).
 * `/winkel/*` en overige app-shell-paden: **top** navigeren — anders vangen we `/diensten`-achtige paden af met
 * `preventDefault` en blijft een klik zonder effect (meerdere path-segmenten).
 *
 * **Concept + token:** zorg dat interne `/site/{slug}/…`-links de `token`-query behouden (en oude `/preview/…`-links naar `/site/…` normaliseren).
 */
export type DraftSiteNavRewriteForIframe = {
  slug: string;
  token: string;
  /** Flyer/QR-preview: `flyer=1` op alle herschreven `/site/…`-URL’s. */
  flyer?: boolean;
  /** Lage segment → canonieke `marketingPages`-key (zelfde als contact-nav `mseg`). */
  mseg?: Record<string, string>;
};

export function buildStudioSinglePageInternalNavScript(
  draftSiteNavRewrite: DraftSiteNavRewriteForIframe | null,
  iframeDocPath?: string | null,
  /** Parent-`origin` (Next `/site`-pagina); nodig voor `postMessage`-target en absolute boek-URL’s in srcDoc-iframe. */
  topPageOrigin?: string | null,
  /** Publiek: `studio-public-nav`. HTML-editor: `gentrix-studio-html-editor-iframe-nav` (geen `location.assign` in parent). */
  navMessageSource: string = STUDIO_PUBLIC_NAV_MESSAGE_SOURCE,
): string {
  const topOriginJson = JSON.stringify((topPageOrigin ?? "").trim());
  const draftJson =
    draftSiteNavRewrite != null &&
    typeof draftSiteNavRewrite.slug === "string" &&
    draftSiteNavRewrite.slug.trim() !== "" &&
    typeof draftSiteNavRewrite.token === "string" &&
    draftSiteNavRewrite.token.trim() !== ""
      ? JSON.stringify({
          slug: draftSiteNavRewrite.slug.trim(),
          token: draftSiteNavRewrite.token.trim(),
          ...(draftSiteNavRewrite.flyer ? { flyer: true } : {}),
          ...(draftSiteNavRewrite.mseg && Object.keys(draftSiteNavRewrite.mseg).length > 0
            ? { mseg: draftSiteNavRewrite.mseg }
            : {}),
        })
      : "null";
  const iframeDocPathJson = JSON.stringify((iframeDocPath ?? "").trim());
  return `<script>
(function(){
  var STUDIO_NAV=${JSON.stringify(navMessageSource)};
  var DRAFT_SITE_NAV_REWRITE=${draftJson};
  var IFRAME_DOC_PATH=${iframeDocPathJson};
  var STUDIO_TOP_ORIGIN=${topOriginJson};
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
        if(DRAFT_SITE_NAV_REWRITE.flyer)out.searchParams.set("flyer","1");
        u.searchParams.forEach(function(v,k){
          if(k==="token")return;
          if(k==="flyer"&&DRAFT_SITE_NAV_REWRITE.flyer)return;
          if(v!=null&&String(v).length)out.searchParams.set(k,v);
        });
        return out.toString();
      }
      function fixMarketingPathIfNeeded(fullPath){
        if(!DRAFT_SITE_NAV_REWRITE.mseg)return fullPath;
        if(fullPath.indexOf(prefSite+"/")!==0)return fullPath;
        var rel=fullPath.slice(prefSite.length+1);
        var firstSeg=(rel.split("/")[0]||"").split("?")[0];
        if(!firstSeg)return fullPath;
        var segDec=firstSeg;
        try{segDec=decodeURIComponent(firstSeg);}catch(__){}
        var repl=DRAFT_SITE_NAV_REWRITE.mseg[segDec.toLowerCase()];
        if(!repl)return fullPath;
        return prefSite+"/"+encodeURIComponent(repl);
      }
      if(path===prefPrev||path.indexOf(prefPrev+"/")===0){
        var tailPrev=path.slice(prefPrev.length);
        var outP=new URL(u.origin+fixMarketingPathIfNeeded(prefSite+tailPrev));
        return mergeQuery(outP);
      }
      if(path!==prefSite&&path.indexOf(prefSite+"/")!==0)return absUrl;
      var fixedPath=fixMarketingPathIfNeeded(path);
      var outS=new URL(u.toString());
      if(fixedPath!==path)outS.pathname=fixedPath;
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
  function isBoekOrWinkelPath(p){
    if(!p||p.charAt(0)!=="/")return false;
    if(p==="/boek"||p.indexOf("/boek/")===0)return true;
    if(p==="/boek-venster"||p.indexOf("/boek-venster/")===0)return true;
    if(p==="/booking-app"||p.indexOf("/booking-app/")===0)return true;
    if(p==="/winkel"||p.indexOf("/winkel/")===0)return true;
    return false;
  }
  function isBookingOnlyPath(p){
    if(!p||p.charAt(0)!=="/")return false;
    if(p==="/boek"||p.indexOf("/boek/")===0)return true;
    if(p==="/boek-venster"||p.indexOf("/boek-venster/")===0)return true;
    if(p==="/booking-app/book"||p.indexOf("/booking-app/book/")===0)return true;
    return false;
  }
  function navigateTopUrl(e,absHref){
    e.preventDefault();
    var url=rewriteDraftSiteNavUrl(absHref);
    if(window.top!==window){
      try{
        if(window.parent&&window.parent!==window){
          var pmOrigin=STUDIO_TOP_ORIGIN&&STUDIO_TOP_ORIGIN.length?STUDIO_TOP_ORIGIN:"*";
          window.parent.postMessage({source:STUDIO_NAV,href:url},pmOrigin);
          return;
        }
      }catch(_){}
      try{window.top.location.assign(url);return;}catch(_){}
      try{window.open(url,"_top");return;}catch(_){}
    }
    try{window.location.assign(url);}catch(_){}
  }
  function navigateTop(e,a){
    navigateTopUrl(e,a.href);
  }
  function isStudioBrandLogoLink(a){
    try{
      return !!(a&&a.closest&&(a.closest("[data-studio-brand-mark]")||a.getAttribute("data-studio-brand-mark")));
    }catch(_){return false;}
  }
  function computeStudioLandingPathnameForBrand(){
    var cur=IFRAME_DOC_PATH||"";
    if(!cur){
      try{cur=window.location.pathname||"";}catch(_){cur="";}
    }
    var p=(cur.split("?")[0]||"").split("#")[0];
    if(p.indexOf("/site/")!==0)return "";
    var parts=p.split("/").filter(Boolean);
    if(parts.length<2)return "";
    return "/site/"+parts[1];
  }
  function computeStudioBrandLandingAbsHref(){
    var pathOnly=computeStudioLandingPathnameForBrand();
    if(!pathOnly)return "";
    var origin=(STUDIO_TOP_ORIGIN&&STUDIO_TOP_ORIGIN.length)?STUDIO_TOP_ORIGIN:"";
    var search="";
    try{search=window.location&&window.location.search?window.location.search:"";}catch(_){}
    try{
      var base=origin||window.location.origin;
      return new URL(pathOnly+search,base).toString();
    }catch(_){return (origin||"")+pathOnly+search;}
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
  /** SSR iframe-doc = /site/{slug}/contact of marketing; depth ≥ 3 = niet op landings-URL. */
  function isPublishedTailwindSubpage(){
    try{
      var cur=(IFRAME_DOC_PATH||"").split("?")[0].split("#")[0];
      if(cur.indexOf("/site/")!==0)return false;
      return sitePublicPathDepth(cur)>=3;
    }catch(_){return false;}
  }
  /** Pretty host: browserpad is /, /contact, … — niet /site/{slug}/…. */
  function isPrettyPublicSiteHost(){
    try{return (window.location.pathname||"").indexOf("/site/")!==0;}catch(_){return true;}
  }
  /* Landings-URL: intern /site/slug of pretty host root + zelfde query (token/flyer). */
  function computePublicHomeLandingAbsHref(){
    var o=(STUDIO_TOP_ORIGIN&&STUDIO_TOP_ORIGIN.length)?STUDIO_TOP_ORIGIN:window.location.origin;
    var search="";
    try{search=window.location&&window.location.search?window.location.search:"";}catch(_){}
    if(isPrettyPublicSiteHost()){
      try{
        var u=new URL("/",o);
        if(search)u.search=search.charAt(0)==="?"?search.slice(1):search;
        return u.toString();
      }catch(_){return o+"/"+(search||"");}
    }
    var internal=computeStudioBrandLandingAbsHref();
    if(internal)return internal;
    try{
      var u2=new URL("/",o);
      if(search)u2.search=search.charAt(0)==="?"?search.slice(1):search;
      return u2.toString();
    }catch(__){return o+"/";}
  }
  function mustNavigateTopForLandingLink(targetPathname){
    var cur=IFRAME_DOC_PATH;
    if(!cur||!targetPathname)return false;
    try{
      var c=(cur.split("?")[0]||"").split("#")[0];
      var t=(targetPathname.split("?")[0]||"").split("#")[0];
      if(t.indexOf("/site/")!==0)return false;
      if(sitePublicPathDepth(t)!==2)return false;
      if(c===t)return false;
      if(c.indexOf(t+"/")===0)return true;
    }catch(_){}
    return false;
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
    var raw=a.getAttribute("href");
    if(!raw)return;
    var href=raw.trim();
    if(a.getAttribute("target")==="_blank"){
      if(!href||/^(mailto:|tel:|javascript:)/i.test(href))return;
      try{
        var pBlank;
        if(/^https?:\\/\\//i.test(href)){
          var uBl=new URL(href);
          pBlank=uBl.pathname||"";
          if(isBookingOnlyPath(pBlank)||pBlank.indexOf("/site/")===0){
            e.preventDefault();
            navigateTop(e,a);
            return;
          }
          if((STUDIO_TOP_ORIGIN&&uBl.origin===STUDIO_TOP_ORIGIN)||uBl.origin===window.location.origin){
            if(isAppShellPath(pBlank))return;
            if(isBoekOrWinkelPath(pBlank)){
              e.preventDefault();
              navigateTop(e,a);
              return;
            }
          }
        }else{
          pBlank=splitHashQuery(href).path;
          if(isBookingOnlyPath(pBlank)||pBlank.indexOf("/site/")===0){
            e.preventDefault();
            navigateTop(e,a);
            return;
          }
          if(isBoekOrWinkelPath(pBlank)){
            e.preventDefault();
            navigateTop(e,a);
            return;
          }
        }
      }catch(__){}
      return;
    }
    if(!href||/^(mailto:|tel:|javascript:)/i.test(href))return;
    if(isStudioBrandLogoLink(a)){
      var land=computeStudioBrandLandingAbsHref();
      if(land){navigateTopUrl(e,land);return;}
    }
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
          if(mustNavigateTopForLandingLink(pn)){
            navigateTop(e,a);
            return;
          }
          var ah=href.indexOf("#");
          var siteHash=ah>=0?href.slice(ah+1):"";
          if(tryScroll(e,siteHash))return;
          window.scrollTo({top:0,behavior:"smooth"});
          return;
        }
        /* Zelfde origin als parent (srcDoc-iframe heeft vaak opaque origin → STUDIO_TOP_ORIGIN). */
        if((STUDIO_TOP_ORIGIN&&u.origin===STUDIO_TOP_ORIGIN)||u.origin===window.location.origin){
          e.preventDefault();
          var sh=u.hash&&u.hash.length>1?u.hash.slice(1):"";
          if(pn==="/"||pn===""){
            if(isPublishedTailwindSubpage()){
              navigateTopUrl(e,computePublicHomeLandingAbsHref());
              return;
            }
            window.scrollTo({top:0,behavior:"smooth"});
            return;
          }
          if(isBoekOrWinkelPath(pn)){navigateTop(e,a);return;}
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
      if(mustNavigateTopForLandingLink(path)){
        navigateTop(e,a);
        return;
      }
      if(tryScroll(e,hash))return;
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    if(path==="/"||path===""){
      e.preventDefault();
      if(isPublishedTailwindSubpage()){
        navigateTopUrl(e,computePublicHomeLandingAbsHref());
        return;
      }
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    if(path.charAt(0)!=="/")return;
    if(isBoekOrWinkelPath(path)){navigateTop(e,a);return;}
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
  /** `false` wanneer afspraken-module uit: geen boekings-`href` uit placeholder. */
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
   * Flyer/QR-concept (`?flyer=1`): zonder gecompileerde CSS laadt de Play CDN nog steeds, maar **geen**
   * `tw-loading` / `body { visibility:hidden }` — de pagina blijft zichtbaar (eventueel kort ongestileerd)
   * i.p.v. seconden een leeg scherm op trage verbindingen.
   */
  relaxedTailwindCdnLoading?: boolean;
  /** Flyer/QR: interne `/site/…`-navigatie behoudt `flyer=1` (actiebalk op subpagina’s). */
  flyerPreview?: boolean;
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
   * Studio iframe-preview: `true` = vaste `width=1280` viewport (expliciete desktop-knop in de editor).
   * `false` = `width=device-width` zodat Tailwind-breakpoints de **iframebreedte** volgen (normale auto-preview).
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
  /** Korte merknaam: o.a. favicon-titel en site-credit-variant; logo-SVG via brand-fallback in bestaande header. */
  navBrandLabel?: string | null;
  /**
   * Pathname van deze pagina zoals in de parent (`/site/{slug}`, marketing-subroute, `/contact`).
   * Zonder dit blijft een home-link op een subpagina hangen in iframe-scroll i.p.v. echte navigatie.
   */
  iframeDocumentPathname?: string | null;
  /**
   * `true` in `SiteHtmlEditor`: `postMessage` met `STUDIO_HTML_EDITOR_IFRAME_NAV_SOURCE` zodat de
   * admin niet naar `/site/…` navigeert; alleen de preview wisselt.
   */
  studioHtmlEditorParentNav?: boolean;
  /**
   * Portaal: postMessage `gentrix-iframe-analytics` (scroll, ready) naar parent; geen effect op publieke
   * inline `/site` (daar draait scroll op `window` in de Next-pagina).
   */
  gentrixIframeAnalytics?: boolean;
  /** Zie `BuildTailwindSectionsBodyOptions.designContract` — nav-preset infer bij ontbrekende `navVisualPreset`. */
  designContract?: DesignGenerationContract | null;
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
      if(!sec)continue;
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
    if(!h)return false;
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
    designContract: options?.designContract ?? null,
  });
  const slug = options?.publishedSlug?.trim();
  const isGentrixHomeSlug = (slug?.toLowerCase() ?? "") === STUDIO_HOMEPAGE_SUBFOLDER_SLUG;
  const siteCreditVariant = pickStudioSiteCreditVariant(slug || options?.navBrandLabel?.trim() || "");
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
  const { fontHeadFragment, fontStack, rootCss, radiusClass } = buildRootCssVarsForTailwindPage(pageConfig ?? null);
  const themeMeta =
    pageConfig && !isLegacyTailwindPageConfig(pageConfig)
      ? `<meta name="generator" content="${escapeDataAttr(pageConfig.style)}"/>`
      : pageConfig && isLegacyTailwindPageConfig(pageConfig)
        ? `<meta name="generator" content="${escapeDataAttr(pageConfig.themeName)}"/>`
        : "";

  const bridge = options?.previewPostMessageBridge !== false ? STUDIO_PREVIEW_BRIDGE_SCRIPT : "";
  const gentrixBridge = options?.gentrixIframeAnalytics === true ? GENTRIX_IFRAME_ANALYTICS_SCRIPT : "";
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
    STUDIO_LASER_LINE_CSS +
    "\n" +
    STUDIO_SCROLL_BORDER_CSS;
  const scrollRevealScript = options?.disableScrollRevealAnimations ? "" : STUDIO_SCROLL_REVEAL_SCRIPT;
  const motionDisabled = Boolean(options?.disableScrollRevealAnimations);
  const scrollBorderScript = STUDIO_SCROLL_BORDER_SCRIPT;
  const shouldLoadAos = htmlUsesAosAttributes(body) || scriptUsesAosRuntime(userJsRaw);
  const shouldLoadGsap = scriptUsesGsapRuntime(userJsRaw);
  const { headLink: aosHeadLink, bodyScripts: aosBodyScripts } = getStudioAosHtmlFragments(
    motionDisabled || !shouldLoadAos,
  );
  const { bodyScripts: gsapBodyScripts } = getStudioGsapHtmlFragments(motionDisabled || !shouldLoadGsap);
  const slugForFav = options?.publishedSlug?.trim() || "preview";
  const displayForFav = options?.navBrandLabel?.trim() || "Site";
  const faviconLink = buildFaviconLinkTagForPublishedSite({
    logoSet: options?.logoSet,
    displayName: displayForFav,
    slug: slugForFav,
    pageConfig: pageConfig ?? null,
  });
  const headMetaExtras = [faviconLink && `  ${faviconLink}`, themeMeta && `  ${themeMeta}`]
    .filter(Boolean)
    .join("\n");

  const compiledRaw = options?.compiledTailwindCss?.trim() ?? "";
  const useCompiledTailwind = compiledRaw.length > 0;
  const relaxedTailwindCdn = Boolean(options?.relaxedTailwindCdnLoading) && !useCompiledTailwind;
  const compiledStyleBlock = useCompiledTailwind
    ? `<style id="studio-compiled-tailwind">\n${sanitizeCompiledTailwindCssForStyleTag(compiledRaw)}\n</style>\n`
    : "";
  const tailwindPreloadLine = useCompiledTailwind
    ? ""
    : `  <link rel="preload" href="${STUDIO_TAILWIND_PLAY_CDN_SRC}" as="script"/>\n`;
  const foucCssBlock = useCompiledTailwind || relaxedTailwindCdn ? "" : `    ${STUDIO_TAILWIND_FOUC_HEAD_CSS}\n`;
  const twLoadingScript =
    useCompiledTailwind || relaxedTailwindCdn ? "" : `<script>document.documentElement.classList.add("tw-loading")</script>\n`;
  const tailwindCdnScripts = useCompiledTailwind
    ? ""
    : relaxedTailwindCdn
      ? `<script src="${STUDIO_TAILWIND_PLAY_CDN_SRC}"></script>\n`
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
          flyerPreview: contactSubpageNavRaw.flyerPreview ?? options?.flyerPreview ?? undefined,
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
  const marketingSlugsForDraft =
    contactSubpageNav?.marketingSlugs?.filter((s): s is string => typeof s === "string" && s.trim().length > 0) ?? [];
  const msegForDraft =
    draftTok.length > 0 && marketingSlugsForDraft.length > 0
      ? buildMarketingSlugSegmentResolutionMap(marketingSlugsForDraft)
      : null;
  const draftSiteNavRewrite: DraftSiteNavRewriteForIframe | null =
    draftTok.length > 0 && draftSlug.length > 0
      ? {
          slug: draftSlug,
          token: draftTok,
          ...(options?.flyerPreview ? { flyer: true as const } : {}),
          ...(msegForDraft && Object.keys(msegForDraft).length > 0 ? { mseg: msegForDraft } : {}),
        }
      : null;

  const iframeDocPathExplicit = options?.iframeDocumentPathname?.trim() ?? "";
  const iframeDocPathForScript =
    iframeDocPathExplicit.length > 0
      ? iframeDocPathExplicit
      : slug
        ? `/site/${encodeURIComponent(slug)}`
        : "";

  const previewOriginTrimmed = options?.previewScriptOrigin?.trim() ?? "";

  const viewportContent = options?.previewMatchParentWindowBreakpoints
    ? "width=1280, initial-scale=1"
    : "width=device-width, initial-scale=1";

  const studioMobileAttr = options?.studioMobileEditorFrame ? ` data-gentrix-studio-mobile="1"` : "";
  const staticScrollBorderAttr = motionDisabled ? ` data-gentrix-static-scroll-border="1"` : "";
  const studioMobileCss = options?.studioMobileEditorFrame
    ? `${STUDIO_MOBILE_EDITOR_FRAME_NAV_CSS}\n${STUDIO_IFRAME_MOBILE_X_LOCK_CSS}\n${STUDIO_IFRAME_MOBILE_EDITOR_NAV_SHEET_CSS}\n`
    : "";
  const isPreviewIframe = options?.previewPostMessageBridge !== false;
const iframeShellAttr = `${isPreviewIframe ? ` data-gentrix-studio-iframe="1"` : ""} data-gentrix-site-credit-variant="${siteCreditVariant}"`;

  // Zonder compiled CSS: Tailwind Play CDN onderaan body (JIT) + FOUC-guard.
  let out = `<!DOCTYPE html>
<html lang="nl"${iframeShellAttr}${studioMobileAttr}${staticScrollBorderAttr}${isGentrixHomeSlug ? ` data-gentrix-scroll-nav-fallback="1"` : ""}>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="${escapeDataAttr(viewportContent)}"/>
${headMetaExtras ? `${headMetaExtras}\n` : ""}${tailwindPreloadLine}${fontHeadFragment ? `${fontHeadFragment}\n` : ""}
  <style>
    ${STUDIO_ALPINE_X_CLOAK_CSS}
    ${STUDIO_VIEW_TRANSITION_CSS}
    ${STUDIO_MOBILE_TOGGLE_POINTER_FIX_CSS}
    /* Vaste top-nav (fixed) + hash-scroll: zonder padding komen koppen onder de balk (afgeknipt, "overlap"). */
    html { scroll-padding-top: ${isGentrixHomeSlug ? "0rem" : "5.5rem"}; }
    /* Geen browser-default marge rondom de preview: voorkomt een witte strook boven de vaste header. */
    html, body { margin: 0; padding: 0; }
    /* iOS: expliciete scroll-richting → browser hoeft richting niet meer te detecteren → soepeler scroll. */
    html { touch-action: pan-y; }
    /* Voorkom wazige rasterisatie op kleine tekst in footers (Chromium + transforms/filters in model-HTML). */
    footer, [role="contentinfo"] {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    body { font-family: ${fontStack}; position: relative; }
    ${rootCss}
    ${animationCss}
    ${STUDIO_NAV_SCROLL_CONTRAST_CSS}
    ${STUDIO_NAV_SCROLL_DIM_CSS}
    ${STUDIO_MOBILE_MENU_STACKING_FIX_CSS}
    ${STUDIO_MOBILE_NAV_DRAWER_FONT_CAP_CSS}
    ${STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS}
    ${STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_NAV_CHROME_MENU_BTN_VISIBILITY_CSS}
    ${STUDIO_FIXED_NAV_HERO_INSET_CSS}
    ${STUDIO_SITE_CREDIT_CSS}
    ${STUDIO_SITE_CREDIT_VARIANT_CSS}
    ${studioMobileCss}${foucCssBlock}  </style>
  ${compiledStyleBlock}${userCssBlock}
${aosHeadLink}</head>
<body class="antialiased text-slate-900${radiusClass}">
${twLoadingScript}${body}
${STUDIO_SITE_CREDIT_BODY_HTML}
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
${buildStudioIosNavFixScript()}
${buildAlpineMobileHeaderScopeRepairScript()}
${buildStudioHeaderNavAlpineClampScript()}
${buildStudioIframeNavResetOnDesktopViewportScript()}
${buildLucidePostAlpineRescanScript()}
${scrollRevealScript}${scrollBorderScript}${gsapBodyScripts}${aosBodyScripts}
${STUDIO_NAV_SCROLL_CONTRAST_SCRIPT}
${STUDIO_STICKY_NAV_OVERFLOW_FIX_SCRIPT}
${contactSubpageScript}
${buildStudioSinglePageInternalNavScript(
    draftSiteNavRewrite,
    iframeDocPathForScript,
    previewOriginTrimmed || null,
    options?.studioHtmlEditorParentNav ? STUDIO_HTML_EDITOR_IFRAME_NAV_SOURCE : STUDIO_PUBLIC_NAV_MESSAGE_SOURCE,
  )}
${bridge}${gentrixBridge}
${userJsBlock}
</body>
</html>`;
  const po = previewOriginTrimmed;
  if (po) out = rewriteStudioPreviewExternalScripts(out, po);
  return out;
}
