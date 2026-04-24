import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConceptFlyerExperienceLazy } from "@/components/site/concept-flyer-experience-lazy";
import { StudioWebsiteOrderClient } from "@/components/site/studio-website-order-client";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { buildNextPublishedSiteIcons } from "@/lib/site/site-identity-favicon";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  try {
    const { slug: raw } = await params;
    const slug = decodeRouteSlugParam(raw);
    const sp = await searchParams;
    const previewToken = typeof sp.token === "string" ? sp.token : "";
    if (!slug) return { title: "Bestellen" };
    const bundle = await getPublishedSiteBySlug(slug, previewToken);
    if (!bundle) return { title: "Bestellen" };
    const conceptRobots = bundle.isConceptTokenAccess
      ? ({ robots: { index: false, follow: false } } as const)
      : ({} as const);
    const displayName =
      bundle.payload.kind === "tailwind"
        ? bundle.payload.clientName?.trim() || formatSlugForDisplay(slug)
        : bundle.payload.kind === "react"
          ? bundle.payload.doc.documentTitle?.trim() || formatSlugForDisplay(slug)
          : formatSlugForDisplay(slug);
    const title = `${displayName} · Bestellen`;
    const base = { title, description: `Bestel en betaal — ${displayName}`, ...conceptRobots };
    if (bundle.payload.kind === "tailwind") {
      return {
        ...base,
        icons: buildNextPublishedSiteIcons({
          logoFavicon: bundle.payload.logoSet?.variants?.favicon,
          displayName,
          slug,
          pageConfig: bundle.payload.config ?? null,
        }),
      };
    }
    if (bundle.payload.kind === "react") {
      return {
        ...base,
        icons: buildNextPublishedSiteIcons({
          logoFavicon: bundle.payload.doc.logoSet?.variants?.favicon,
          displayName,
          slug,
          themePrimaryHex: bundle.payload.doc.theme.primary,
        }),
      };
    }
    return {
      ...base,
      icons: buildNextPublishedSiteIcons({ displayName, slug }),
    };
  } catch {
    return { title: "Bestellen", robots: { index: true, follow: true } };
  }
}

export default async function PublicStudioSiteOrderPage({ params, searchParams }: PageProps) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) notFound();

  const sp = await searchParams;
  const previewToken = typeof sp.token === "string" ? sp.token : "";
  const bundle = await getPublishedSiteBySlug(slug, previewToken);
  if (!bundle) notFound();

  const qs = new URLSearchParams();
  if (previewToken.trim()) qs.set("token", previewToken.trim());
  if (sp.flyer === "1") qs.set("flyer", "1");
  const tq = qs.toString() ? `?${qs.toString()}` : "";
  const backHref = `/site/${encodeURIComponent(slug)}${tq}`;

  const siteLabel =
    bundle.payload.kind === "tailwind"
      ? bundle.payload.clientName?.trim() || formatSlugForDisplay(slug)
      : bundle.payload.kind === "react"
        ? bundle.payload.doc.documentTitle?.trim() || formatSlugForDisplay(slug)
        : formatSlugForDisplay(slug);

  const showFlyer = sp.flyer === "1" && bundle.isConceptTokenAccess;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <StudioWebsiteOrderClient slug={slug} siteLabel={siteLabel} previewToken={previewToken.trim()} backHref={backHref} />
      {showFlyer ? (
        <ConceptFlyerExperienceLazy
          siteLabel={siteLabel}
          slug={slug}
          appointmentsEnabled={bundle.appointmentsEnabled}
          webshopEnabled={bundle.webshopEnabled}
          previewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken).trim() || null : null}
          preserveFlyerQuery={showFlyer}
        />
      ) : null}
    </div>
  );
}
