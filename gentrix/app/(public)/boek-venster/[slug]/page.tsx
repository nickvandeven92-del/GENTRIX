import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingVensterFrame } from "@/components/public/booking-venster-frame";
import { PublicModuleInactive } from "@/components/public/public-module-inactive";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
import { publicLiveBookingHref } from "@/lib/site/studio-section-visibility";
import { getPublicAppUrl } from "@/lib/site/public-app-url";

const BOOKING_SPA_INDEX = join(process.cwd(), "public", "booking-app", "index.html");

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const resolved = await resolveActivePortalClientIdBySlug(slug);
  if (!resolved.ok) {
    return { title: "Boeken" };
  }
  return { title: `Afspraak — ${resolved.name}` };
}

export default async function BoekVensterPage({ params }: Props) {
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
          description="Online afspraken maken is voor deze site nog niet geactiveerd."
        />
      </div>
    );
  }

  if (!existsSync(BOOKING_SPA_INDEX)) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">Boekingsinterface ontbreekt</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            De Vite booking-app is nog niet in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/booking-app/</code>{" "}
            gebouwd.
          </p>
        </div>
      </div>
    );
  }

  const iframeSrc = publicLiveBookingHref(slug);

  return <BookingVensterFrame businessName={resolved.name} iframeSrc={iframeSrc} />;
}
