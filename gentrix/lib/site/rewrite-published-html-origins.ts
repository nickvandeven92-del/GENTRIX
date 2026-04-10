/**
 * Vervangt in gegenereerde site-HTML absolute URLs naar dev-hosts door het **huidige** browservenster-origin.
 * Voorkomt dat klikken in de iframe naar `localhost` navigeert (ERR_CONNECTION_REFUSED op productie/preview).
 */
export function rewriteStudioDevOriginsInHtml(html: string, pageOrigin: string): string {
  const o = pageOrigin.replace(/\/$/, "");
  if (!o) return html;
  return html.replace(/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?/gi, o);
}
