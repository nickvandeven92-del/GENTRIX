import { PublicSitePageSkeleton } from "@/components/site/public-site-page-skeleton";

/** Korte RSC-fase: zelfde shell als client-iframe-build → minder visuele “knip” dan spinner + tekst. */
export default function PublicSiteSlugLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <PublicSitePageSkeleton />
    </div>
  );
}