import { revalidateTag } from "next/cache";

/** Zelfde sleutel als `publishedSiteTag` in `get-published-site.ts` — geen import i.v.m. cyclus. */
function publishedSiteSlugTag(slug: string): string {
  return `published-site:${slug}`;
}

/**
 * Bust `unstable_cache` voor `getPublishedSiteBySlug` + gerelateerde site-data.
 * Aanroepen na draft-opslag / snapshot-wijziging zodat `/site/...?token=` niet tot `revalidate` vastzit op oude HTML.
 */
export function revalidatePublishedSiteBundleCacheForSlug(subfolderSlug: string): void {
  const slug = subfolderSlug.trim();
  if (!slug) return;
  try {
    revalidateTag("published-site", { expire: 0 });
    revalidateTag("site-snapshot", { expire: 0 });
    revalidateTag(publishedSiteSlugTag(slug), { expire: 0 });
  } catch {
    /* buiten Next request context */
  }
}
