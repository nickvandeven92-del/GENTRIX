/**
 * Server-safe Tailwind-landing HTML (DOMPurify + theme-vars). Gebruikt door iframe-preview en SSR-publieke routes.
 */
import DOMPurify from "isomorphic-dompurify";
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
import { buildUserScriptTagForHtmlDocument, sanitizeUserSiteCss } from "@/lib/site/user-site-assets";
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
 * CSS voor `data-animation` (fade-up, slide-in-*, scale-in).
 * Animaties starten **pas** als `.studio-in-view` gezet wordt (scroll-reveal script) — zo voelt de pagina
 * “levend” zoals bij Lovable: hero bij binnenkomst, diensten-blokken bij scroll.
 */
export const STUDIO_DATA_ANIMATION_CSS = `@media (prefers-reduced-motion: no-preference) {
  [data-animation="fade-up"] {
    animation: studio-fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    animation-play-state: paused;
  }
  [data-animation="fade-up"].studio-in-view { animation-play-state: running; }
  [data-animation="fade-in"] {
    animation: studio-fade-in 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    animation-play-state: paused;
  }
  [data-animation="fade-in"].studio-in-view { animation-play-state: running; }
  [data-animation="slide-in-left"] {
    animation: studio-slide-left 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    animation-play-state: paused;
  }
  [data-animation="slide-in-left"].studio-in-view { animation-play-state: running; }
  [data-animation="slide-in-right"] {
    animation: studio-slide-right 0.85s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    animation-play-state: paused;
  }
  [data-animation="slide-in-right"].studio-in-view { animation-play-state: running; }
  [data-animation="scale-in"] {
    animation: studio-scale-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
    animation-delay: var(--studio-stagger, 0ms);
    animation-play-state: paused;
  }
  [data-animation="scale-in"].studio-in-view { animation-play-state: running; }
  /*
   * Hero / bovenkant: met paused + opacity:0 in keyframes blijft content onzichtbaar tot IntersectionObserver
   * vuurt. In srcDoc-iframes (/site, preview) faalt of vertraagt dat vaak → hele pagina "wit" onder de nav.
   * Vrijstellingen: echte section#hero, #hero op willekeurig element (model gebruikt vaak div#hero), en de
   * eerste paar studio-sectiewrappers (nav + hero als aparte secties).
   */
  section#hero [data-animation="fade-up"],
  section#hero [data-animation="fade-in"],
  section#hero [data-animation="slide-in-left"],
  section#hero [data-animation="slide-in-right"],
  section#hero [data-animation="scale-in"],
  #hero [data-animation="fade-up"],
  #hero [data-animation="fade-in"],
  #hero [data-animation="slide-in-left"],
  #hero [data-animation="slide-in-right"],
  #hero [data-animation="scale-in"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="fade-up"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="fade-in"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="slide-in-left"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="slide-in-right"],
  body > section.w-full:nth-of-type(-n+3) [data-animation="scale-in"] {
    animation-play-state: running;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-animation] { animation: none !important; }
}
@keyframes studio-fade-up { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: none; } }
@keyframes studio-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes studio-slide-left { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: none; } }
@keyframes studio-slide-right { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: none; } }
@keyframes studio-scale-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: none; } }`;

/**
 * Nood-CSS als `disableScrollRevealAnimations` expliciet aan staat: geen paused keyframes / IO.
 * Normale weergave: STUDIO_DATA_ANIMATION_CSS + STUDIO_MARQUEE_CSS + STUDIO_LASER_LINE_CSS + STUDIO_SCROLL_REVEAL_SCRIPT.
 */
export const STUDIO_DATA_ANIMATION_DISABLED_CSS = `/* Geen scroll-reveal: inhoud met data-animation direct zichtbaar */
[data-animation] {
  animation: none !important;
  opacity: 1 !important;
  transform: none !important;
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

/** Zet `.studio-in-view` op `[data-animation]` wanneer het element in (of net boven) de viewport komt; stagger per sectie. */
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
    if(!nodes.length)return;
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
    },{root:null,rootMargin:"0px 0px 12% 0px",threshold:0.01});
    for(var n=0;n<nodes.length;n++)io.observe(nodes[n]);
    /* Als IO in iframe / layout nooit triggert: nooit opacity:0 laten hangen */
    setTimeout(function(){
      var p=document.querySelectorAll("[data-animation]:not(.studio-in-view)");
      for(var k=0;k<p.length;k++)p[k].classList.add("studio-in-view");
    },2200);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
  else boot();
})();
</script>`;

export function buildLucideRuntimeScriptBlock(): string {
  return `<script src="${STUDIO_LUCIDE_UMD_SRC}"></script>
<script>try{typeof lucide!=="undefined"&&lucide.createIcons();}catch(e){}</script>`;
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

  DOMPurify.addHook("uponSanitizeAttribute", (_node, data) => {
    if (data.attrName === "style" && data.attrValue) {
      data.attrValue = sanitizeInlineStyle(data.attrValue);
    }
  });

  const purified = DOMPurify.sanitize(stripLikelyBrokenImgTags(html), {
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
      "data-lucide",
      "data-studio-brand-mark",
      "data-studio-visibility",
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
 * of blokkeer host-navigatie.
 * Links naar app-shell (`/portal/*`, `/admin`, `/login`, `/home`, `/dashboard`) moeten **top** navigeren,
 * anders blijft de adresbalk op `/` en zie je o.a. kale login in de iframe.
 */
export const STUDIO_SINGLE_PAGE_INTERNAL_NAV_SCRIPT = `<script>
(function(){
  var STUDIO_NAV=${JSON.stringify(STUDIO_PUBLIC_NAV_MESSAGE_SOURCE)};
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
    var url=a.href;
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
};

export function buildTailwindIframeSrcDoc(
  sections: TailwindSection[],
  pageConfig?: TailwindPageConfig | null,
  options?: BuildTailwindIframeSrcDocOptions,
): string {
  let body = buildTailwindSectionsBodyInnerHtml(sections, pageConfig, {
    logoSet: options?.logoSet,
  });
  const slug = options?.publishedSlug?.trim();
  if (slug) {
    const appt = options?.appointmentsEnabled;
    const shop = options?.webshopEnabled;
    const previewTok = options?.draftPublicPreviewToken?.trim();
    body = applyStudioPublishedPathPlaceholders(body, slug, {
      includeBooking: appt !== false,
      includeShop: shop !== false,
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
      ? STUDIO_DATA_ANIMATION_DISABLED_CSS
      : STUDIO_DATA_ANIMATION_CSS) +
    "\n" +
    STUDIO_MARQUEE_CSS +
    "\n" +
    STUDIO_LASER_LINE_CSS;
  const scrollRevealScript = options?.disableScrollRevealAnimations ? "" : STUDIO_SCROLL_REVEAL_SCRIPT;
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
    contactSubpageNav.landingSectionIds?.length
      ? buildContactSubpageCaptureNavScript(contactSubpageNav)
      : "";

  const viewportContent = options?.previewMatchParentWindowBreakpoints
    ? "width=1280, initial-scale=1"
    : "width=device-width, initial-scale=1";

  // Zonder compiled CSS: Tailwind Play CDN onderaan body (JIT) + FOUC-guard.
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="${escapeDataAttr(viewportContent)}"/>
${headMetaExtras ? `${headMetaExtras}\n` : ""}${tailwindPreloadLine}  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontLink}" rel="stylesheet"/>
  <style>
    /* Vaste top-nav (fixed) + hash-scroll: zonder padding komen koppen onder de balk (afgeknipt, "overlap"). */
    html { scroll-padding-top: 5.5rem; }
    body { font-family: ${fontStack}; }
    ${rootCss}
    ${animationCss}
${foucCssBlock}  </style>
  ${compiledStyleBlock}${userCssBlock}
</head>
<body class="antialiased text-slate-900${radiusClass}">
${twLoadingScript}${body}
${tailwindCdnScripts}<script defer src="${STUDIO_ALPINE_CDN_SRC}"></script>
${scrollRevealScript}
${contactSubpageScript}
${STUDIO_SINGLE_PAGE_INTERNAL_NAV_SCRIPT}
${buildLucideRuntimeScriptBlock()}
${bridge}
${userJsBlock}
</body>
</html>`;
}
