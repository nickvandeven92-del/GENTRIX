type Props = {
  businessName: string;
  /** Publieke marketing-site van dezelfde klant. */
  publicSiteHref: string;
  /** Optioneel: volledige iframe-URL; `{slug}` wordt vervangen door de subfolder-slug. */
  embedSrcTemplate?: string | null;
  subfolderSlug: string;
};

/**
 * Landingspagina wanneer `webshop_enabled` aan staat. Externe catalogus (bijv. Chameleon) kan via env worden ingeladen.
 */
export function PublicWebshopLanding({ businessName, publicSiteHref, embedSrcTemplate, subfolderSlug }: Props) {
  const enc = encodeURIComponent(subfolderSlug);
  const t = embedSrcTemplate?.trim() ?? "";
  const iframeSrc =
    t.length > 0 && t.includes("{slug}") ? t.replace(/\{slug\}/g, enc) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm dark:border-emerald-900/50 dark:bg-zinc-900/50">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Webshop — {businessName}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Online bestellen is geactiveerd. Hier kun je je productcatalogus tonen (bijv. via embed) of bezoekers doorverwijzen
          naar je externe winkel.
        </p>
        <a
          href={publicSiteHref}
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
        >
          ← Terug naar de website
        </a>
        {iframeSrc ? (
          <div className="mt-8">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Catalogus</p>
            <iframe
              title={`Webshop ${businessName}`}
              src={iframeSrc}
              className="h-[min(85vh,920px)] w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-700"
            />
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Koppel je externe winkel (bijv. Chameleon Cart) door in <code className="font-mono text-xs">.env</code>{" "}
            <code className="font-mono text-xs">NEXT_PUBLIC_WEBSHOP_IFRAME_SRC_TEMPLATE</code> te zetten op een URL met{" "}
            <code className="font-mono text-xs">{"{slug}"}</code> — anders toont deze pagina alleen deze uitleg.
          </p>
        )}
      </div>
    </div>
  );
}
