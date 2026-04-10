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
  STUDIO_DATA_ANIMATION_CSS,
  STUDIO_LASER_LINE_CSS,
  STUDIO_MARQUEE_CSS,
  STUDIO_ALPINE_X_CLOAK_CSS,
  STUDIO_SCROLL_REVEAL_SCRIPT,
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

  if (!forScan && publish && publish.subfolderSlug.trim()) {
    const slug = publish.subfolderSlug.trim();
    bodyInner = applyStudioPublishedPathPlaceholders(bodyInner, slug, {
      includeBooking: publish.appointmentsEnabled,
      includeShop: publish.webshopEnabled,
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

  const alpineScript = `<script defer src="${STUDIO_ALPINE_CDN_SRC}"></script>\n  `;
  const styleBlock =
    styleMode === "local_css"
      ? `<link rel="stylesheet" href="styles.css"/>\n  ${alpineScript}`
      : `<script src="https://cdn.tailwindcss.com"></script>\n  ${alpineScript}`;

  const uCss = userAssets?.css?.trim() ?? "";
  const uJs = userAssets?.js?.trim() ?? "";
  const userCssBlock = uCss ? `<style id="studio-user-css">\n${sanitizeUserSiteCss(uCss)}\n</style>\n  ` : "";
  const userJsBlock = uJs ? `\n${buildUserScriptTagForHtmlDocument(uJs)}` : "";
  const faviconLink = buildFaviconLinkTagForLogoSet(userAssets?.logoSet);

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtmlText(docTitle)}</title>
  ${faviconLink ? `  ${faviconLink}\n  ` : ""}${themeMeta}${styleBlock}<link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="${fontLink}" rel="stylesheet"/>
  <style>
    ${STUDIO_ALPINE_X_CLOAK_CSS}
    body { font-family: ${fontStack}; }
    ${rootCssBlock}
    ${STUDIO_DATA_ANIMATION_CSS}
    ${STUDIO_MARQUEE_CSS}
    ${STUDIO_LASER_LINE_CSS}
  </style>
  ${userCssBlock}</head>
<body class="min-h-screen antialiased text-slate-900${radiusClass}">
${bodyInner}
${STUDIO_SCROLL_REVEAL_SCRIPT}
${buildLucideRuntimeScriptBlock()}${userJsBlock}
</body>
</html>`;
}

export const STANDALONE_EXPORT_README_NL = `Website-export (FTP / eigen hosting)
====================================

Inhoud
------
- index.html — publieke homepage (marketing). Portaal-blokken uit Studio zitten hier niet in.
- styles.css — gegenereerde Tailwind-utilities op basis van jouw pagina (geen Tailwind-CDN nodig).
- images/ — externe plaatjes (Unsplash e.d.) zijn meegenomen waar dat lukte; anders blijft de externe link staan.
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
- Beweging: elementen met data-animation (fade-up, slide-in-left, …) animeren wanneer ze in beeld komen (Intersection Observer), met lichte stagger binnen dezelfde sectie — vergelijkbaar met scroll-entrance op moderne sites. Bij “verminder beweging” in het OS worden animaties uitgezet.
- Marquee/ticker: optioneel \`studio-marquee\` + \`studio-marquee-track\` met dubbele inhoud voor een oneindige horizontale band (logo’s of tekst); pauzeert automatisch bij “verminder beweging”.
- Premium merk-SVG: alleen als de site is gegenereerd met ENABLE_BRAND_LOGO_SYSTEM=1 in .env.local; het logo hoort dan als inline-SVG of img in index.html te staan (niet als los bestand in images/). Ontbrak het in de model-HTML, dan voegt de export/publicatie automatisch het primary-SVG toe na de eerste header/nav/section (attribuut data-studio-brand-mark).
- Eigen JS/CSS uit de HTML-editor staan in index.html; controleer die code voordat je publiceert.
- Lettertypen: Google Fonts worden nog van fonts.googleapis.com geladen (eenmalige download door de browser).
  Geen internet? Vervang die regels in index.html door lokale @font-face (optioneel).
- Waar eerst een Studio-portaal-link stond, staat "#". Vervang door je eigen URL indien nodig.

RAR
---
Dit bestand is ZIP. Voor RAR: lokaal hercomprimeren met WinRAR of 7-Zip.
`;
