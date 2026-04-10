import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHtmlEditor } from "@/components/admin/site-html-editor";
import { getParsedSiteDraftBySlug } from "@/lib/data/client-draft-site";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { formatSlugForDisplay } from "@/lib/slug";

type EditorPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EditorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  const row = await getAdminClientBySlug(decoded);
  const label = row?.name?.trim() || formatSlugForDisplay(decoded);
  return { title: `Editor · ${label}` };
}

export default async function AdminEditorPage({ params }: EditorPageProps) {
  const { slug } = await params;
  if (!slug) notFound();

  const row = await getAdminClientBySlug(slug);
  if (!row) notFound();

  const commercial = await getClientCommercialBySlug(slug);
  const appointmentsEnabled = commercial?.appointments_enabled ?? false;
  const webshopEnabled = commercial?.webshop_enabled ?? false;

  const parsed = await getParsedSiteDraftBySlug(slug);

  if (parsed?.kind === "react") {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h1 className="text-lg font-semibold text-amber-950 dark:text-amber-100">React-concept (niet meer bewerkbaar hier)</h1>
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          Deze site staat nog als <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/60">react_sections</code>{" "}
          in de database. We gebruiken weer <strong>HTML + Tailwind</strong> (<code className="font-mono text-xs">tailwind_sections</code>
          ) voor nieuwe generaties en de site-editor.
        </p>
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
          Genereer de pagina opnieuw in de <strong>site-studio</strong> en sla op — dan kun je hier verder met de HTML-editor.
          Live weergave van deze slug blijft werken tot je overschrijft.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/admin/ops/studio?slug=${encodeURIComponent(slug)}`}
            className="text-sm font-medium text-amber-950 underline dark:text-amber-100"
          >
            Naar studio →
          </Link>
          <Link
            href={`/admin/clients/${encodeURIComponent(slug)}`}
            className="text-sm font-medium text-amber-950 underline dark:text-amber-100"
          >
            ← Terug naar dossier
          </Link>
        </div>
      </div>
    );
  }

  if (parsed?.kind === "tailwind") {
    return (
      <SiteHtmlEditor
        subfolderSlug={row.subfolder_slug}
        initialName={row.name}
        initialDescription={row.description}
        initialStatus={row.status}
        initialSections={parsed.sections}
        initialConfig={parsed.config}
        initialPageType={parsed.pageType}
        initialCustomCss={parsed.customCss}
        initialCustomJs={parsed.customJs}
        initialLogoSet={parsed.logoSet}
        appointmentsEnabled={appointmentsEnabled}
        webshopEnabled={webshopEnabled}
        initialSiteIr={parsed.siteIr ?? null}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 dark:border-amber-900/50 dark:bg-amber-950/30">
      <h1 className="text-lg font-semibold text-amber-950 dark:text-amber-100">Geen bewerkbare site</h1>
      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
        Deze editor ondersteunt <strong>tailwind_sections</strong> (HTML-secties). Genereer een site in de site-studio of sla
        geldige data op via het klantdossier / API.
      </p>
      <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/80">
        Legacy JSON-sites kunnen hier niet worden bewerkt; genereer opnieuw voor een moderne Tailwind-site.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/admin/clients/${encodeURIComponent(slug)}`}
          className="text-sm font-medium text-amber-950 underline dark:text-amber-100"
        >
          ← Terug naar dossier
        </Link>
        <Link
          href={`/admin/ops/studio?slug=${encodeURIComponent(slug)}`}
          className="text-sm font-medium text-amber-950 underline dark:text-amber-100"
        >
          Naar studio
        </Link>
      </div>
    </div>
  );
}
