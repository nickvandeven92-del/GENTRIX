import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicConceptPreviewAccess } from "@/lib/preview/public-concept-preview-access";
import { decodeRouteSlugParam } from "@/lib/slug";

type PageProps = {
  params: Promise<{ slug: string; marketingSlug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Pagina", robots: { index: false, follow: false } };
}

/** Oude `/preview/.../sub` → `/site/.../sub?token=`. */
export default async function PublicConceptPreviewMarketingSubPage({ params, searchParams }: PageProps) {
  const { slug, marketingSlug: rawSeg } = await params;
  const sp = await searchParams;
  const decoded = decodeRouteSlugParam(slug);
  const seg = decodeRouteSlugParam(rawSeg);
  if (!decoded || !seg) notFound();

  const token = typeof sp.token === "string" ? sp.token : "";
  const access = await getPublicConceptPreviewAccess(decoded, token);
  if (access === "not_found") notFound();
  if (access === "redirect_active") {
    redirect(`/site/${encodeURIComponent(decoded)}/${encodeURIComponent(seg)}`);
  }
  redirect(
    `/site/${encodeURIComponent(decoded)}/${encodeURIComponent(seg)}?token=${encodeURIComponent(token)}`,
  );
}
