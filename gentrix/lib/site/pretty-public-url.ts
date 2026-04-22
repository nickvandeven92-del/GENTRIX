import { headers } from "next/headers";
import {
  PRETTY_URL_BASE_PATH_HEADER,
  PRETTY_URL_HOST_HEADER,
} from "@/lib/supabase/middleware-primary-landing";

/**
 * Runtime-context voor de pretty-URL flow.
 *
 * - `active`: request komt van een host waar we `/site/{slug}` uit de URL willen strippen
 *   (primair studio-domein met landing-slug, of klant-custom-domein).
 * - `basePathPrefix`: de interne `/site/{encoded_slug}` prefix die we in redirects weer moeten
 *   omzetten naar pretty URLs.
 */
export type PrettyPublicUrlContext = {
  active: boolean;
  basePathPrefix: string | null;
};

export async function readPrettyPublicUrlContext(): Promise<PrettyPublicUrlContext> {
  try {
    const h = await headers();
    const flag = h.get(PRETTY_URL_HOST_HEADER);
    if (flag !== "1") {
      return { active: false, basePathPrefix: null };
    }
    const basePath = h.get(PRETTY_URL_BASE_PATH_HEADER);
    return {
      active: true,
      basePathPrefix: basePath && basePath.startsWith("/site/") ? basePath : null,
    };
  } catch {
    return { active: false, basePathPrefix: null };
  }
}

/**
 * Zet een interne redirect-target (`/site/{slug}[/...]`) om naar de pretty URL op de huidige host.
 * Onbekende paden (niet onder `basePathPrefix`) blijven ongewijzigd zodat redirects naar `/login`,
 * `/boek/…` e.d. blijven werken.
 *
 * Zoekparameters (`?token=…`) worden **alleen** behouden op interne paden; pretty URL’s worden
 * gebruikt in een context zonder concept-token (`active` is alleen true voor live-verkeer).
 */
export function toPrettyPublicRedirectTarget(
  internalTarget: string,
  ctx: PrettyPublicUrlContext,
): string {
  if (!ctx.active || !ctx.basePathPrefix) return internalTarget;
  const basePath = ctx.basePathPrefix;
  const [pathRaw, ...rest] = internalTarget.split("#");
  const hash = rest.length > 0 ? `#${rest.join("#")}` : "";
  const [path, queryRaw] = (pathRaw ?? "").split("?");
  const query = queryRaw ? `?${queryRaw}` : "";

  if (!path) return internalTarget;

  if (path === basePath) {
    return `/${query}${hash}`;
  }
  if (path.startsWith(`${basePath}/`)) {
    const tail = path.slice(basePath.length); // start met '/'
    return `${tail}${query}${hash}`;
  }
  return internalTarget;
}
