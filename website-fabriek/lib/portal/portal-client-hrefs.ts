/**
 * Paden naar het klantportaal (zelfde host; gebruiker moet ingelogd + MFA zijn).
 */
export function hrefPortalFacturen(subfolderSlug: string): string {
  return `/portal/${encodeURIComponent(subfolderSlug)}/facturen`;
}

export function hrefPortalFactuurDetail(subfolderSlug: string, invoiceId: string): string {
  return `/portal/${encodeURIComponent(subfolderSlug)}/facturen/${encodeURIComponent(invoiceId)}`;
}
