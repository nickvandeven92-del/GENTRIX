import type { Metadata } from "next";
import { GeneratorForm } from "@/components/admin/generator-form";
import { StudioTailwindWorkspace } from "@/components/admin/studio-tailwind-workspace";
import { getParsedSiteDraftBySlug } from "@/lib/data/client-draft-site";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getClientSiteUrlsForAdminDossier } from "@/lib/data/client-preview-urls";
import { getRequestOrigin } from "@/lib/site/request-origin";

type Props = { searchParams: Promise<{ slug?: string; preset?: string }> };

export const metadata: Metadata = {
  title: "Site-studio",
};

export default async function SalesOpsStudioPage({ searchParams }: Props) {
  const { slug } = await searchParams;
  const decodedSlug = slug ? decodeURIComponent(slug) : "";
  const existing = decodedSlug ? await getAdminClientBySlug(decodedSlug) : null;
  const parsed = decodedSlug ? await getParsedSiteDraftBySlug(decodedSlug) : null;
  const existingDraftLocked = parsed != null;

  if (parsed?.kind === "tailwind" && existing) {
    const commercial = await getClientCommercialBySlug(decodedSlug);
    const appointmentsEnabled = commercial?.appointments_enabled ?? false;
    const webshopEnabled = commercial?.webshop_enabled ?? false;
    const origin = await getRequestOrigin();
    const siteUrls = await getClientSiteUrlsForAdminDossier(existing.subfolder_slug, origin);
    let draftPublicPreviewToken: string | null = null;
    if (siteUrls?.previewAbsolute) {
      try {
        draftPublicPreviewToken = new URL(siteUrls.previewAbsolute).searchParams.get("token");
      } catch {
        draftPublicPreviewToken = null;
      }
    }

    return (
      <div className="studio-generator-scope flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        <StudioTailwindWorkspace
          subfolderSlug={existing.subfolder_slug}
          draftUpdatedAt={existing.updated_at}
          initialName={existing.name}
          initialDescription={existing.description}
          initialStatus={existing.status}
          initialSections={parsed.sections}
          initialConfig={parsed.config}
          initialPageType={parsed.pageType}
          initialCustomCss={parsed.customCss}
          initialCustomJs={parsed.customJs}
          initialLogoSet={parsed.logoSet}
          initialContactSections={parsed.contactSections}
          initialMarketingPages={parsed.marketingPages}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
          initialSiteIr={parsed.siteIr ?? null}
          initialSectionIdsOrdered={parsed.sectionIdsOrdered}
          draftPublicPreviewToken={draftPublicPreviewToken}
          initialTailwindCompiledCss={parsed.tailwindCompiledCss ?? null}
        />
      </div>
    );
  }

  const commercialForGenerator = decodedSlug ? await getClientCommercialBySlug(decodedSlug) : null;
  const generatorAppointmentsEnabled = commercialForGenerator?.appointments_enabled ?? false;
  const generatorWebshopEnabled = commercialForGenerator?.webshop_enabled ?? false;

  return (
    <div className="studio-generator-scope flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
      {existingDraftLocked && parsed?.kind === "react" ? (
        <div className="shrink-0 border-b border-amber-200/80 bg-amber-50/95 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
          Dit dossier heeft nog <strong>React</strong>-concept (<code className="font-mono">react_sections</code>). Nieuwe
          generatie is <strong>HTML + Tailwind</strong> — bij opslaan vervang je het concept (daarna HTML-editor).
        </div>
      ) : null}
      {existingDraftLocked && parsed?.kind === "legacy" ? (
        <div className="shrink-0 border-b border-amber-200/80 bg-amber-50/95 px-4 py-2.5 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
          Dit dossier heeft <strong>legacy</strong> JSON. Genereer opnieuw voor een moderne Tailwind-site, of migreer
          handmatig.
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <GeneratorForm
          initialSubfolderSlug={slug}
          initialClientName={existing?.name}
          initialClientDescription={existing?.description}
          existingDraftLocked={existingDraftLocked}
          appointmentsEnabled={generatorAppointmentsEnabled}
          webshopEnabled={generatorWebshopEnabled}
        />
      </div>
    </div>
  );
}
