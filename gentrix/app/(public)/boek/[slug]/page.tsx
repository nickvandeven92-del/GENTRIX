import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { PublicModuleInactive } from "@/components/public/public-module-inactive";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { getPublicAppUrl } from "@/lib/site/public-app-url";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return { title: "Boeken" };
  }
  if (!resolved.appointmentsEnabled) {
    return { title: `Online boeken — ${resolved.name}` };
  }
  return { title: `Afspraak — ${resolved.name}` };
}

export default async function PublicBookingPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    notFound();
  }

  const appOrigin = getPublicAppUrl();
  const publicSiteHref = `${appOrigin}/site/${encodeURIComponent(slug)}`;

  if (!resolved.appointmentsEnabled) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
        <PublicModuleInactive
          businessName={resolved.name}
          publicSiteHref={publicSiteHref}
          title="Online boeken"
          description="Online afspraken maken is voor deze site nog niet geactiveerd. Je kunt wel doorklikken naar de website voor andere contactmogelijkheden."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <PublicBookingForm slug={slug} businessName={resolved.name} />
    </div>
  );
}
