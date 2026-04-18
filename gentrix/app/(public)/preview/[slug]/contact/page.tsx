import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicConceptPreviewAccess } from "@/lib/preview/public-concept-preview-access";
import { decodeRouteSlugParam } from "@/lib/slug";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Contact", robots: { index: false, follow: false } };
}

/** Oude `/preview/.../contact` → `/site/.../contact?token=`. */
export default async function PublicConceptPreviewContactPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const decoded = decodeRouteSlugParam(slug);
  if (!decoded) notFound();

  const token = typeof sp.token === "string" ? sp.token : "";
  const access = await getPublicConceptPreviewAccess(decoded, token);
  if (access === "not_found") notFound();
  if (access === "redirect_active") {
    redirect(`/site/${encodeURIComponent(decoded)}/contact`);
  }
  redirect(`/site/${encodeURIComponent(decoded)}/contact?token=${encodeURIComponent(token)}`);
}
