import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConceptFlyerExperience } from "@/components/site/concept-flyer-experience";
import { PublishedSiteView } from "@/components/site/published-site-view";
import { getPublishedSiteBySlug } from "@/lib/data/get-published-site";
import { MAX_FAVICON_DATA_URL_CHARS } from "@/lib/site/tailwind-page-html";
import { isLegacyTailwindPageConfig } from "@/lib/ai/tailwind-sections-schema";
import { decodeRouteSlugParam, formatSlugForDisplay } from "@/lib/slug";

type SitePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; flyer?: string }>;
};

export const revalidate = 60;

export async function generateMetadata({ params, searchParams }: SitePageProps): Promise<Metadata> {
  try {
    const { slug: raw } = await params;
    const slug = decodeRouteSlugParam(raw);
    const sp = await searchParams;
    const previewToken = typeof sp.token === "string" ? sp.token : "";
    const bundle = await getPublishedSiteBySlug(slug, previewToken);
    if (!bundle) {
      return { title: "Site niet gevonden" };
    }
    const conceptRobots = bundle.isConceptTokenAccess
      ? ({ robots: { index: false, follow: false } } as const)
      : ({} as const);
    const row = bundle.payload;
    if (row.kind === "legacy") {
      return {
        title: row.site.meta.title,
        description: row.site.meta.description,
        ...conceptRobots,
      };
    }
    const displayName = row.clientName?.trim() || formatSlugForDisplay(slug);
    if (row.kind === "react") {
      const title = row.doc.documentTitle?.trim() || displayName;
      const base = {
        title,
        description: `Website van ${displayName}`,
        ...conceptRobots,
      };
      const fav = row.doc.logoSet?.variants.favicon?.trim() ?? "";
      if (!fav || fav.length > MAX_FAVICON_DATA_URL_CHARS) return base;
      return {
        ...base,
        icons: {
          icon: [
            {
              url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fav)}`,
              type: "image/svg+xml",
            },
          ],
        },
      };
    }
    const base = {
      title: displayName,
      description: `Website van ${displayName}`,
      ...conceptRobots,
    };
    const fav = row.logoSet?.variants.favicon?.trim() ?? "";
    if (!fav || fav.length > MAX_FAVICON_DATA_URL_CHARS) return base;
    return {
      ...base,
      icons: {
        icon: [
          {
            url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fav)}`,
            type: "image/svg+xml",
          },
        ],
      },
    };
  } catch {
    return { title: "Site", robots: { index: true, follow: true } };
  }
}

/** Publieke klant-site: SSR + SiteRenderer of Tailwind-secties (SEO-vriendelijk). Concept: zelfde routes met `?token=`. */
export default async function PublicClientSitePage({ params, searchParams }: SitePageProps) {
  const { slug: raw } = await params;
  const slug = decodeRouteSlugParam(raw);
  if (!slug) notFound();

  const sp = await searchParams;
  const previewToken = typeof sp.token === "string" ? sp.token : "";
  const bundle = await getPublishedSiteBySlug(slug, previewToken);
  if (!bundle) notFound();

  const showFlyer = sp.flyer === "1" && bundle.isConceptTokenAccess;
  const shell = (() => {
    const p = bundle.payload;

    if (p.kind === "tailwind") {
      const cfg = p.config != null && !isLegacyTailwindPageConfig(p.config) ? p.config : undefined;
      const bg = cfg?.theme?.background?.trim() || cfg?.theme?.primary?.trim() || "#ffffff";
      const fg = cfg?.theme?.textColor?.trim() || "#171717";
      return { bg, fg };
    }

    if (p.kind === "react") {
      return {
        bg: p.doc?.theme?.background?.trim() || "#ffffff",
        fg: p.doc?.theme?.foreground?.trim() || "#171717",
      };
    }

    if (p.kind === "legacy") {
      return {
        bg: (p.site as { theme?: { background?: string; foreground?: string } })?.theme?.background?.trim() || "#ffffff",
        fg: (p.site as { theme?: { background?: string; foreground?: string } })?.theme?.foreground?.trim() || "#171717",
      };
    }

    return { bg: "#ffffff", fg: "#171717" };
  })();
  const siteLabel =
    bundle.payload.kind === "tailwind"
      ? bundle.payload.clientName?.trim() || formatSlugForDisplay(slug)
      : bundle.payload.kind === "react"
        ? bundle.payload.doc.documentTitle?.trim() || formatSlugForDisplay(slug)
        : formatSlugForDisplay(slug);

  return (
    <>
      <style>{`
        :root{
          --public-site-shell-bg:${shell.bg};
          --public-site-shell-fg:${shell.fg};
        }
        html,body{
          background:${shell.bg}!important;
          color:${shell.fg}!important;
        }
      `}</style>
      {showFlyer ? (
        <ConceptFlyerExperience
          siteLabel={siteLabel}
          slug={slug}
          appointmentsEnabled={bundle.appointmentsEnabled}
          webshopEnabled={bundle.webshopEnabled}
          previewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
          preserveFlyerQuery={showFlyer}
        />
      ) : null}
      <PublishedSiteView
        payload={bundle.payload}
        publishedSlug={slug}
        appointmentsEnabled={bundle.appointmentsEnabled}
        webshopEnabled={bundle.webshopEnabled}
        draftPublicPreviewToken={bundle.isConceptTokenAccess ? (bundle.conceptPreviewToken ?? previewToken) : null}
      />
    </>
  );
}
