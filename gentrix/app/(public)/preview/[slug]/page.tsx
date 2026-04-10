import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicConceptPreviewAccess } from "@/lib/preview/public-concept-preview-access";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeRouteSlugParam(slug);
  const label = formatSlugForDisplay(decoded);
  return {
    title: `Concept · ${label}`,
    robots: { index: false, follow: false },
  };
}

/** Oude `/preview`-URL → zelfde inhoud op `/site/{slug}?token=` (bookmark-compat). */
export default async function PublicConceptPreviewPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const decoded = decodeRouteSlugParam(slug);
  if (!decoded) notFound();

  const token = typeof sp.token === "string" ? sp.token : "";
  const access = await getPublicConceptPreviewAccess(decoded, token);
  if (access === "not_found") notFound();
  if (access === "redirect_active") {
    redirect(`/site/${encodeURIComponent(decoded)}`);
  }
  redirect(`/site/${encodeURIComponent(decoded)}?token=${encodeURIComponent(token)}`);
}
