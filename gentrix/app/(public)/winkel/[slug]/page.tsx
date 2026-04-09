import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicWebshopLanding } from "@/components/public/public-webshop-landing";
import { resolveActiveClientWebshopBySlug } from "@/lib/portal/resolve-portal-client";
import { getPublicAppUrl } from "@/lib/site/public-app-url";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActiveClientWebshopBySlug(slug);
  if (!resolved.ok || !resolved.webshopEnabled) {
    return { title: "Webshop" };
  }
  return { title: `Webshop — ${resolved.name}` };
}

export default async function PublicWebshopPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActiveClientWebshopBySlug(slug);
  if (!resolved.ok || !resolved.webshopEnabled) {
    notFound();
  }

  const appOrigin = getPublicAppUrl();
  const enc = encodeURIComponent(slug);
  const publicSiteHref = `${appOrigin}/site/${enc}`;
  const embedTemplate = process.env.NEXT_PUBLIC_WEBSHOP_IFRAME_SRC_TEMPLATE?.trim() || null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <PublicWebshopLanding
        businessName={resolved.name}
        publicSiteHref={publicSiteHref}
        embedSrcTemplate={embedTemplate}
        subfolderSlug={slug}
      />
    </div>
  );
}
