import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivePortalClient } from "@/lib/data/get-portal-client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const portal = await getActivePortalClient(decodeURIComponent(slug));
  if (!portal) return { title: "Portaal" };
  return { title: `Reviews — ${portal.name}` };
}

export default async function PortalReviewsPage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const portal = await getActivePortalClient(decoded);
  if (!portal) notFound();

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reviews koppelen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Koppel hier je reviewbron. Tot de koppeling actief is, toont je website tijdelijke voorbeeldreviews.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Hoe werkt het</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>De generator maakt eerst een nette reviewsectie met placeholders voor de preview.</li>
          <li>Na koppeling van Google of Trustpilot worden live reviews automatisch leidend.</li>
          <li>Als de live-bron tijdelijk niet reageert, blijft de laatst gesynchroniseerde set zichtbaar.</li>
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Google Reviews</h3>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Vul je Google Place ID in. Na verificatie halen we je publieke reviews op.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Zoek je bedrijf in Google Maps.</li>
            <li>Haal de Place ID op via de Google Place ID tool.</li>
            <li>Plak de ID in het veld “Google Place ID” en klik op Verifiëren.</li>
          </ol>
        </article>

        <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Trustpilot</h3>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Vul het domein in dat aan je Trustpilot Business profiel is gekoppeld.
          </p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Open je Trustpilot Business account.</li>
            <li>Controleer welk website-domein daar geregistreerd staat.</li>
            <li>Plak het domein in het veld “Trustpilot domein” en klik op Verifiëren.</li>
          </ol>
        </article>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        Zie je nog voorbeeldreviews na het koppelen? Wacht 1-2 minuten voor de eerste sync of neem contact op via het tabblad
        Support.
      </section>
    </main>
  );
}
