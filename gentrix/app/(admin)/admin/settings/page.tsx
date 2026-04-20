import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Instellingen",
};

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Instellingen</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Account, facturatie en integraties — naar behoefte uit te breiden.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Websites</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Aanpassingen doe je in de HTML-editor per klant. Er is één technische opzet; commerciële verschillen (abonnement,
          eenmalig, …) vullen je in onder Commercie per klant.
        </p>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <Link
            href="/admin/ops/werkwijze"
            className="font-medium text-violet-800 underline dark:text-violet-400"
          >
            Veelgestelde vragen (uitleg in gewone taal) →
          </Link>
          <Link
            href="/admin/prompt"
            className="font-medium text-zinc-600 underline dark:text-zinc-400"
          >
            Generator-referentie (technisch, voor ontwikkelaars) →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Twee-stapsverificatie (MFA)</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Bij elke login ontvang je een 6-cijferige code op je e-mailadres. Geen app nodig.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Altijd ingeschakeld
          </span>
          <span className="text-xs text-zinc-500">Twee-stapsverificatie is verplicht voor alle accounts en kan niet worden uitgeschakeld.</span>
        </div>
      </section>
    </div>
  );
}
