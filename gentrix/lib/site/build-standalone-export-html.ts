import {
  isLegacyTailwindPageConfig,
  type TailwindPageConfig,
  type TailwindSection,
} from "@/lib/ai/tailwind-sections-schema";
import {
  buildLucideRuntimeScriptBlock,
  buildRootCssVarsForTailwindPage,
  buildFaviconLinkTagForLogoSet,
  buildTailwindSectionsBodyInnerHtml,
  STUDIO_BORDER_REVEAL_CSS,
  STUDIO_DATA_ANIMATION_CSS,
  STUDIO_LASER_LINE_CSS,
  STUDIO_MARQUEE_CSS,
  STUDIO_ALPINE_X_CLOAK_CSS,
  STUDIO_MOBILE_MENU_STACKING_FIX_CSS,
  STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS,
  STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS,
  buildStudioHeaderNavAlpineClampScript,
  STUDIO_NAV_SCROLL_CONTRAST_CSS,
  STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS,
  STUDIO_NAV_SCROLL_CONTRAST_SCRIPT,
  STUDIO_SCROLL_REVEAL_SCRIPT,
  STUDIO_SCROLL_BORDER_CSS,
  STUDIO_SCROLL_BORDER_SCRIPT,
  STUDIO_SITE_CREDIT_BODY_HTML,
  STUDIO_SITE_CREDIT_CSS,
  STUDIO_FIXED_NAV_HERO_INSET_CSS,
  getStudioAosHtmlFragments,
  getStudioGsapHtmlFragments,
} from "@/lib/site/tailwind-page-html";
import { STUDIO_ALPINE_CDN_SRC } from "@/lib/site/studio-alpine-cdn";
import { composePublicMarketingTailwindSections } from "@/lib/site/public-site-composition";
import {
  applyStudioPublishedPathPlaceholders,
  filterSectionsForPublicSite,
  stripLeakedStudioPlaceholderTokens,
  STUDIO_BOOKING_PATH_PLACEHOLDER,
  STUDIO_PORTAL_PATH_PLACEHOLDER,
  STUDIO_SHOP_PATH_PLACEHOLDER,
} from "@/lib/site/studio-section-visibility";
import { buildUserScriptTagForHtmlDocument, sanitizeUserSiteCss } from "@/lib/site/user-site-assets";
import {
  buildStudioAutoMobileNavHeaderHtml,
  extractHeaderNavLinks,
  shouldInjectStudioAutoMobileNav,
  STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS,
  STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS,
} from "@/lib/site/studio-auto-mobile-nav";
import type { GeneratedLogoSet } from "@/types/logo";

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type StandaloneExportStyleMode = "tailwind_cdn" | "local_css";

/** Standaard voor export/CLI-scan: geen Play CDN (productie en `@source`-build). */
const DEFAULT_STANDALONE_EXPORT_STYLE: StandaloneExportStyleMode = "local_css";

export type StandaloneExportUserAssets = {
  css?: string;
  js?: string;
  logoSet?: GeneratedLogoSet | null;
  /**
   * `true`: alle publieke marketingsecties (incl. booking/shop-blokken) blijven in de DOM voor
   * `@source`-Tailwind-build; placeholders → `#`. Gebruik alleen voor CSS-compilatie, niet voor index.html.
   */
  forTailwindClassScan?: boolean;
  /** Live parity: CRM-toggles + slug; portaal-placeholder blijft `#` (eigen hosting). */
  exportPublish?: {
    subfolderSlug: string;
    appointmentsEnabled: boolean;
    webshopEnabled: boolean;
  };
};

/**
 * Volledige HTML voor ZIP-export. `local_css`: link naar styles.css (FTP-bundle, aanbevolen);
 * `tailwind_cdn`: Tailwind Play CDN (alleen prototyping / offline demo met internet).
 *
 * Zie ook ZIP/FTP-build (`build-ftp-website-zip.ts`) voor Tailwind-JIT export van secties.
 */
export function buildStandaloneExportHtmlDocument(
  sections: TailwindSection[],
  pageConfig: TailwindPageConfig | null | undefined,
  docTitle: string,
  styleMode: StandaloneExportStyleMode = DEFAULT_STANDALONE_EXPORT_STYLE,
  userAssets?: StandaloneExportUserAssets,
): string {
  const publicOnly = filterSectionsForPublicSite(sections);
  const forScan = userAssets?.forTailwindClassScan === true;
  const publish = userAssets?.exportPublish;
  const sectionSource =
    !forScan && publish
      ? composePublicMarketingTailwindSections(publicOnly, {
          appointmentsEnabled: publish.appointmentsEnabled,
          webshopEnabled: publish.webshopEnabled,
        })
      : publicOnly;

  let bodyInner = buildTailwindSectionsBodyInnerHtml(sectionSource, pageConfig, {
    logoSet: userAssets?.logoSet,
  });
  const existingHeaderLinks = extractHeaderNavLinks(bodyInner);
  const autoNavSourceBodyInner = bodyInner;
  let studioAutoMobileNavInjected = false;
  if (
    !forScan &&
    sectionSource.length > 0 &&
    shouldInjectStudioAutoMobileNav(autoNavSourceBodyInner)
  ) {
    bodyInner = `${buildStudioAutoMobileNavHeaderHtml(
      sectionSource,
      pageConfig ?? null,
      {
        logoSet: userAssets?.logoSet,
        navBrandLabel: docTitle.trim() || null,
      },
      existingHeaderLinks,
    )}\n${autoNavSourceBodyInner}`;
    studioAutoMobileNavInjected = true;
  }

  if (!forScan && publish && publish.subfolderSlug.trim()) {
    const slug = publish.subfolderSlug.trim();
    bodyInner = applyStudioPublishedPathPlaceholders(bodyInner, slug, {
      resolvePortalPath: false,
    });
    bodyInner = stripLeakedStudioPlaceholderTokens(bodyInner);
  } else {
    bodyInner = bodyInner.split(STUDIO_PORTAL_PATH_PLACEHOLDER).join("#");
    bodyInner = bodyInner.split(STUDIO_BOOKING_PATH_PLACEHOLDER).join("#");
    bodyInner = bodyInner.split(STUDIO_SHOP_PATH_PLACEHOLDER).join("#");
  }

  const { fontLink, fontStack, rootCss, radiusClass } = buildRootCssVarsForTailwindPage(pageConfig ?? null);
  const themeMeta =
    pageConfig && !isLegacyTailwindPageConfig(pageConfig)
      ? `<meta name="generator" content="${escapeHtmlText(pageConfig.style)}"/>\n  `
      : pageConfig && isLegacyTailwindPageConfig(pageConfig)
        ? `<meta name="generator" content="${escapeHtmlText(pageConfig.themeName)}"/>\n  `
        : "";

  const rootCssBlock = rootCss ? rootCss.replace(/\s+/g, " ") : "";

  const lucideBlock = `${buildLucideRuntimeScriptBlock()}\n  `;
  const alpineScript = `<script defer src="${STUDIO_ALPINE_CDN_SRC}"></script>\n  `;
  const styleBlock =
    styleMode === "local_css"
      ? `<link rel="stylesheet" href="styles.css"/>\n  `
      : `<script src="https://cdn.tailwindcss.com"></script>\n  `;

  const uCss = userAssets?.css?.trim() ?? "";
  const uJs = userAssets?.js?.trim() ?? "";
  const userCssBlock = uCss ? `<style id="studio-user-css">\n${sanitizeUserSiteCss(uCss)}\n</style>\n  ` : "";
  const userJsBlock = uJs ? `\n${buildUserScriptTagForHtmlDocument(uJs)}` : "";
  const faviconLink = buildFaviconLinkTagForLogoSet(userAssets?.logoSet);
  const aos = getStudioAosHtmlFragments(false);
  const gsap = getStudioGsapHtmlFragments(false);

  return `<!DOCTYPE html>
<html lang="nl" data-gentrix-studio-iframe="1"${studioAutoMobileNavInjected ? ` data-gentrix-studio-auto-nav="1"` : ""}>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtmlText(docTitle)}</title>
  ${faviconLink ? `  ${faviconLink}\n  ` : ""}${themeMeta}${styleBlock}<link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontLink}" rel="stylesheet"/>
  <style>
    ${STUDIO_ALPINE_X_CLOAK_CSS}
    html { scroll-padding-top: 5.5rem; }
    body { font-family: ${fontStack}; }
    ${rootCssBlock}
    ${STUDIO_DATA_ANIMATION_CSS}
    ${STUDIO_BORDER_REVEAL_CSS}
    ${STUDIO_MARQUEE_CSS}
    ${STUDIO_LASER_LINE_CSS}
    ${STUDIO_SCROLL_BORDER_CSS}
    ${STUDIO_MOBILE_MENU_STACKING_FIX_CSS}
    ${STUDIO_IFRAME_PREVIEW_HEADER_Z_CSS}
    ${STUDIO_IFRAME_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_NAV_SCROLL_CONTRAST_CSS}
    ${STUDIO_DESKTOP_NAV_HIDDEN_UTIL_FIX_CSS}
    ${STUDIO_SITE_CREDIT_CSS}
    ${STUDIO_FIXED_NAV_HERO_INSET_CSS}
    ${studioAutoMobileNavInjected ? `${STUDIO_AUTO_MOBILE_NAV_DUPLICATE_HEADER_HIDE_CSS}\n    ${STUDIO_AUTO_MOBILE_NAV_LINK_CONTRAST_CSS}\n    ` : ""}
  </style>
  ${userCssBlock}${aos.headLink}</head>
<body class="min-h-screen antialiased text-slate-900${radiusClass}"${studioAutoMobileNavInjected ? ` id="top"` : ""}>
${bodyInner}
${STUDIO_SITE_CREDIT_BODY_HTML}
${STUDIO_SCROLL_REVEAL_SCRIPT}${STUDIO_SCROLL_BORDER_SCRIPT}${gsap.bodyScripts}${aos.bodyScripts}
${STUDIO_NAV_SCROLL_CONTRAST_SCRIPT}
${lucideBlock}<script>
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
${alpineScript}${buildStudioHeaderNavAlpineClampScript()}${userJsBlock}
</body>
</html>`;
}

export const STANDALONE_EXPORT_README_NL = `Website-export (FTP / eigen hosting)
====================================

Inhoud
------
- index.html — publieke homepage (marketing). Portaal-blokken uit Studio zitten hier niet in.
- styles.css — gegenereerde Tailwind-utilities op basis van jouw pagina (geen Tailwind-CDN nodig).
- images/ — externe plaatjes zijn meegenomen waar dat lukte; anders blijft de externe link staan.
- INTEGRATIE-backend-en-AB.txt — korte gids: Supabase/Firebase, formulieren, A/B-testtools (geen volledige app in deze ZIP).

Uploaden
--------
1. Pak het ZIP-bestand uit.
2. Upload alles naar je host (public_html, www of submap) via FTP of bestandsbeheer.
3. Zorg dat index.html de startpagina is.

Technisch
---------
- Styling: styles.css is lokaal; je site werkt ook als cdn.tailwindcss.com geblokkeerd is.
- Interactiviteit: Alpine.js wordt van jsDelivr geladen (zelfde als in de Studio-preview). Zonder internet werken geen Alpine-micro-interacties (FAQ-uitklap, menu-toggle, enz.).
- Iconen: Lucide (attribuut data-lucide) wordt van jsDelivr geladen en na load geïnitialiseerd — zonder internet verschijnen die pictogrammen niet.
- Beweging: elementen met \`data-animation\` (fade-up, slide-in-left, …) animeren wanneer ze in beeld komen (eigen Intersection Observer). **AOS** staat via unpkg (\`data-aos\`). **GSAP 3** staat via jsDelivr: \`gsap\`, **ScrollTrigger**, **Flip**, **MotionPathPlugin**, **Observer** — gebruik ze in **Eigen JS** (\`gsap.to\`, timelines, ScrollTrigger); **geen** eigen \`<script>\` in sectie-HTML. **Niet** \`data-aos\` en \`data-animation\` op hetzelfde element. Bij “verminder beweging” schakelt AOS uit; beperk zware GSAP in Eigen JS zelf.
- Sticky/fixed top-nav: automatische donkere menu-tekst op lichte achtergrond (scroll) — zet \`data-studio-skip-nav-tone\` op een wrapper om dit uit te zetten.
- Accent-lijnen: \`studio-border-reveal studio-border-reveal--h\` (horizontaal) of \`--v\` (verticaal) — lijn “groeit” van ~72% naar 100% bij scroll (zelfde observer als data-animation). Optioneel \`[--studio-br-rgb:R_G_B]\` voor kleur.
- Volledig kader: \`data-studio-scroll-border\` + \`--studio-sb-stroke\` (verplicht op die wrapper) — zichtbare rand ~75%→100% mee met **document-scroll**; geen eigen \`<script>\`.
- Horizontale ticker (\`studio-marquee\`): wordt **niet** meer gegenereerd; bestaande geëxporteerde pagina’s kunnen de klassen nog bevatten — de bundel levert nog compatibiliteits-CSS; pauzeert bij “verminder beweging”.
- Premium merk-SVG: alleen als de site is gegenereerd met ENABLE_BRAND_LOGO_SYSTEM=1 in .env.local; het logo hoort dan als inline-SVG of img in index.html te staan (niet als los bestand in images/). Ontbrak het in de model-HTML, dan voegt de export/publicatie automatisch het primary-SVG toe na de eerste header/nav/section (attribuut data-studio-brand-mark).
- Eigen JS/CSS uit de HTML-editor staan in index.html; controleer die code voordat je publiceert.
- Lettertypen: Google Fonts worden nog van fonts.googleapis.com geladen (eenmalige download door de browser).
  Geen internet? Vervang die regels in index.html door lokale @font-face (optioneel).
- Waar eerst een Studio-portaal-link stond, staat "#". Vervang door je eigen URL indien nodig.

RAR
---
Dit bestand is ZIP. Voor RAR: lokaal hercomprimeren met WinRAR of 7-Zip.
`;
