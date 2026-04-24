/**
 * Standaard `loading="lazy"` voor `<img>` die geen expliciete laadstrategie hebben.
 * Niet gebruiken op de eerste sectie of op LCP-kandidaten (`fetchpriority="high"`).
 */

export function addDefaultLazyLoadingToBelowFoldSectionImages(html: string): string {
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs: string) => {
    if (/\bloading\s*=/i.test(attrs)) return full;
    if (/\bfetchpriority\s*=\s*["']high["']/i.test(attrs)) return full;
    const rest = attrs.trim();
    const decoding = /\bdecoding\s*=/i.test(attrs) ? "" : ' decoding="async"';
    const spacer = rest.length ? " " : "";
    return `<img loading="lazy"${decoding}${spacer}${rest}>`;
  });
}
