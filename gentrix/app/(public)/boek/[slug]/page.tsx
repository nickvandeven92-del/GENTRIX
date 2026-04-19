import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PublicModuleInactive } from "@/components/public/public-module-inactive";
import { resolveActivePortalClientIdBySlug } from "@/lib/portal/resolve-portal-client";
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

  if (!existsSync(BOOKING_SPA_INDEX)) {
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h1 className="text-lg font-semibold">Boekingsinterface ontbreekt</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            De Vite booking-app is nog niet in <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">public/booking-app/</code>{" "}
            gebouwd. Voer in de projectroot uit:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-sm text-zinc-100">npm run build:booking-app</pre>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Daarna <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run dev</code> of deploy opnieuw —{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">npm run build</code> bouwt automatisch eerst de SPA.
          </p>
        </div>
      </div>
    );
  }

  redirect(`/booking-app/book/${encodeURIComponent(slug)}`);
}
