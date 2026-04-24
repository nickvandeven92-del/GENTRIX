import type { Metadata } from "next";

/**
 * Cross-document View Transitions (Chrome o.a.): vloeiende overgang tussen volledige
 * document-navigaties zonder `router.push`. Combineer met client-side soft-nav waar nodig.
 *
 * @see https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
 */
export const publishedSiteViewTransitionMetadata: Metadata = {
  other: {
    "view-transition": "same-origin",
  },
};

/** Optioneel: gedeelde morph-naam voor header/nav zodat die visueel “vast” kan ogen. */
export const publishedSiteViewTransitionScopedCss = `@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.22s;
  }
  .gentrix-published-root > header:first-of-type,
  .gentrix-published-root > nav:first-of-type,
  .gentrix-published-root > section:first-of-type > header:first-of-type,
  .gentrix-published-root > section:first-of-type > nav:first-of-type {
    view-transition-name: gentrix-published-chrome;
  }
}`;
