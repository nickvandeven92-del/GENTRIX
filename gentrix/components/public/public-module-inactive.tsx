import Link from "next/link";

type PublicModuleInactiveProps = {
  /** Weergavenaam van de klant */
  businessName: string;
  /** Link terug naar de publieke marketing-site */
  publicSiteHref: string;
  /** Korte titel boven de uitleg */
  title: string;
  /** Uitleg voor bezoeker (bijv. boeken nog niet actief) */
  description: string;
};

/**
 * Geldige pagina wanneer een module-route bestaat maar CRM de feature nog niet actief heeft:
 * geen 404, geen `href="#"`-fallback op de marketing-site.
 */
export function PublicModuleInactive({ businessName, publicSiteHref, title, description }: PublicModuleInactiveProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{businessName}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{description}</p>
      <p className="mt-6">
        <Link
          href={publicSiteHref}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Terug naar de website
        </Link>
      </p>
    </div>
  );
}
