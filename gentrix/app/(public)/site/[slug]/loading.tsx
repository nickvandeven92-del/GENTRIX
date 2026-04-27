import { PublicSitePageSkeleton } from "@/components/site/public-site-page-skeleton";

/**
 * Directe shell tijdens RSC + zware `buildTailwindIframeSrcDoc`-SSR (elke request is dynamisch door `headers()` in pretty-URL-context).
 */
export default function PublicSiteSlugLoading() {
  return <PublicSitePageSkeleton className="min-h-screen" />;
}
