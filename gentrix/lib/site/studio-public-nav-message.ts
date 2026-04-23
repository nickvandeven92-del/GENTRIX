/** Iframe (Tailwind-marketing) → parent: top-level navigatie als sandbox `top.location` blokkeert. */
export const STUDIO_PUBLIC_NAV_MESSAGE_SOURCE = "studio-public-nav";

/**
 * Alleen `SiteHtmlEditor`: parent blijft in `/admin`, schakelt alleen de inline preview (geen
 * `location.assign` op `/site/…` in hetzelfde tabblad — dat zou de CRM verlaten).
 */
export const STUDIO_HTML_EDITOR_IFRAME_NAV_SOURCE = "gentrix-studio-html-editor-iframe-nav" as const;
