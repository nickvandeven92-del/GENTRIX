/**
 * Lange uitleg voor Site-studio → Nieuwe generatie.
 * Los van het formulier gehouden (dialog vanuit workspace-toolbar).
 */
export function GeneratorStudioFaqContent() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700">
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Hoe genereer je?</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs">
          <li>
            Vul <strong>bedrijfsnaam</strong> en <strong>omschrijving</strong> (briefing) in. Kort mag; de Denklijn vult
            details aan. Tip: vraagteken bij Omschrijving voor stijltermen.
          </li>
          <li>
            Optioneel: <strong>klantfoto&apos;s</strong> en een <strong>referentiesite</strong> voor sfeer/layout.
          </li>
          <li>
            Met een klant-URL (<code className="rounded bg-slate-200 px-1 font-mono text-[11px]">slug</code>) klopt
            opslaan bij die klant.
          </li>
          <li>
            Klik <strong>Genereer site</strong>; de preview verschijnt rechts als de run klaar is (server-job + poll).
          </li>
          <li>
            Sla op via het paneel onderaan. Na concept: briefing vast — verdere edits via tab <strong>Bewerken</strong>.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-600">
          Volledige marketing-site: homepage (<code className="font-mono text-[11px]">/site/…</code>) met subpagina&apos;s
          + contact. Tokens zoals <code className="font-mono text-[11px]">__STUDIO_SITE_BASE__</code> worden door het
          platform vervangen.
        </p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Blueprints vs. links in de HTML</h3>
        <p className="mt-2 text-xs text-slate-600">
          Studio-tokens (<code className="font-mono text-[11px]">__STUDIO_PORTAL_PATH__</code>, boeken, webshop, …)
          blijven in opgeslagen HTML; preview/live zet ze om naar echte paden. Blueprint/site-IR beschrijft structuur naast
          de HTML.
        </p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Boeken &amp; webshop</h3>
        <p className="mt-2 text-xs text-slate-600">
          Volledige checkout/agenda zit niet in de generator-HTML; modules schakel je per klant (Portaal). CRM bepaalt of{" "}
          <code className="font-mono text-[11px]">/boek/…</code> / <code className="font-mono text-[11px]">/winkel/…</code>{" "}
          actief is.
        </p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-slate-900">Editor &amp; tokens</h3>
        <p className="mt-2 text-xs text-slate-600">
          In de bron blijven <code className="font-mono text-[11px]">__STUDIO_…</code> in <code className="font-mono">href</code>{" "}
          vaak zichtbaar — in preview/live worden ze vervangen.
        </p>
      </section>
    </div>
  );
}
