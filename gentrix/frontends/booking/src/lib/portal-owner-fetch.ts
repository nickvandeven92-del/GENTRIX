/**
 * Portal-API’s (Next) vanuit de Vite booking-app: zelfde origin in productie, proxy in dev.
 */
export async function portalOwnerFetch(slug: string, path: string, init?: RequestInit): Promise<Response> {
  const enc = encodeURIComponent(slug);
  const url = `/api/portal/clients/${enc}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
