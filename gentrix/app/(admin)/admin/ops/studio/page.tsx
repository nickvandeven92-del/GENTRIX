import type { Metadata } from "next";
import { PanelTop } from "lucide-react";
import { GeneratorForm } from "@/components/admin/generator-form";
import { StudioTailwindWorkspace } from "@/components/admin/studio-tailwind-workspace";
import { getParsedSiteDraftBySlug } from "@/lib/data/client-draft-site";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getClientSiteUrlsForAdminDossier } from "@/lib/data/client-preview-urls";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { formatSlugForDisplay } from "@/lib/slug";

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
          initialName={existing.name}
          initialDescription={existing.description}
          initialStatus={existing.status}
          initialSections={parsed.sections}
          initialConfig={parsed.config}
          initialPageType={parsed.pageType}
          initialCustomCss={parsed.customCss}
          initialCustomJs={parsed.customJs}
          initialLogoSet={parsed.logoSet}
          appointmentsEnabled={appointmentsEnabled}
          webshopEnabled={webshopEnabled}
          initialSiteIr={parsed.siteIr ?? null}
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
    <div className="studio-generator-scope flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 sales-os-glass-panel rounded-2xl border border-neutral-200 bg-white p-6 md:p-8 dark:border-zinc-600/80 dark:bg-zinc-900/50">
        <div className="flex flex-col gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-white/10">
              <PanelTop className="size-6 text-neutral-600 dark:text-zinc-300" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-zinc-50">Site-studio</h1>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-zinc-400">
                Genereer landingspagina&apos;s als <strong className="font-medium text-neutral-800 dark:text-zinc-200">tailwind_sections</strong>{" "}
                (HTML-secties met Tailwind): <strong className="font-medium text-neutral-800 dark:text-zinc-200">links</strong>{" "}
                opdracht en knoppen, <strong className="font-medium text-neutral-800 dark:text-zinc-200">rechts</strong> een
                preview die bij de <strong className="font-medium text-neutral-800 dark:text-zinc-200">eerste</strong> run{" "}
                <strong className="font-medium text-neutral-800 dark:text-zinc-200">pas na afloop</strong> vult (zoals o.a.
                Lovable — geen live canvas tussendoor). Daarna kun je via tab <strong className="font-medium text-neutral-800 dark:text-zinc-200">Bewerken</strong>{" "}
                iteratief aanpassen met directe preview. Zelfde weergave als{" "}
                <code className="rounded bg-neutral-100 px-1 font-mono text-xs dark:bg-white/10">/site/…</code>. Op breed
                scherm sleep je de rand tussen de panelen. Kies een unieke URL-slug bij opslaan. De publieke homepage (
                <code className="rounded bg-neutral-100 px-1 font-mono text-xs text-neutral-800 dark:bg-white/10 dark:text-zinc-200">/</code>)
                is de vaste bureau-landingspagina; slug{" "}
                <code className="rounded bg-neutral-100 px-1 font-mono text-xs text-neutral-800 dark:bg-white/10 dark:text-zinc-200">home</code>{" "}
                wordt daar niet meer automatisch op geladen (wel bruikbaar voor klant-sites en previews).{" "}
                {slug ? (
                  <span className="font-medium text-neutral-800 dark:text-zinc-200">
                    {existing?.name?.trim() ? (
                      <>
                        Je bewerkt nu <strong>{existing.name.trim()}</strong>
                        <span className="font-normal text-neutral-600 dark:text-zinc-400">
                          {" "}
                          · slug{" "}
                          <code className="rounded bg-neutral-100 px-1 font-mono text-xs dark:bg-white/10 dark:text-zinc-200">
                            {decodeURIComponent(slug)}
                          </code>
                        </span>
                      </>
                    ) : (
                      <>
                        Je bewerkt nu <strong>{formatSlugForDisplay(decodeURIComponent(slug))}</strong>{" "}
                        <span className="font-normal text-neutral-600 dark:text-zinc-400">
                          (
                          <code className="rounded bg-neutral-100 px-1 font-mono text-xs dark:bg-white/10 dark:text-zinc-200">
                            {decodeURIComponent(slug)}
                          </code>
                          )
                        </span>
                      </>
                    )}
                    .
                  </span>
                ) : null}
              </p>
              {existingDraftLocked && parsed?.kind === "react" ? (
                <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
                  Dit dossier heeft nog <strong>React</strong>-concept (<code className="font-mono">react_sections</code>
                  ). Nieuwe generatie is <strong>HTML + Tailwind</strong> — bij opslaan vervang je het concept (daarna
                  HTML-editor).
                </p>
              ) : null}
              {existingDraftLocked && parsed?.kind === "legacy" ? (
                <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
                  Dit dossier heeft <strong>legacy</strong> JSON. Genereer opnieuw voor een moderne Tailwind-site, of
                  migreer handmatig.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
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
