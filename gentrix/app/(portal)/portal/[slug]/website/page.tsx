import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalVisualSiteEditor } from "@/components/portal/portal-visual-site-editor";
import { PortalWebsitePanel } from "@/components/portal/portal-website-panel";
import { getDraftPublishedSitePayloadBySlug, getDraftSiteJsonBySlug } from "@/lib/data/client-draft-site";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { loadTailwindPayloadFromDraftJson } from "@/lib/portal/portal-draft-section-mutate";
import { getRequestOrigin } from "@/lib/site/request-origin";
import { readOriginalPageConfigForSlug } from "@/lib/portal/theme-variants-cache-server";

export const dynamic = "force-dynamic";

function labelForMarketingPage(pageKey: string): string {
  return pageKey
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!slug) return { title: "Website" };
  const c = await getActivePortalClient(decodeURIComponent(slug));
  if (!c) return { title: "Website" };
  return { title: `Website — ${c.name}` };
}

export default async function PortalWebsitePage({ params }: Props) {
  const { slug } = await params;
  if (!slug) notFound();

  const decoded = decodeURIComponent(slug);
  const client = await getActivePortalClient(decoded);
  if (!client) notFound();

  const draftJson = await getDraftSiteJsonBySlug(decoded);
  const loadedDraft = draftJson ? loadTailwindPayloadFromDraftJson(draftJson) : { ok: false as const, error: "Geen concept-data." };
  const draftPayload = await getDraftPublishedSitePayloadBySlug(decoded);
  const editorPages = loadedDraft.ok
    ? [
        {
          id: "main",
          label: "Home",
          sections: loadedDraft.payload.sections.map((section, index) => ({
            key: `main:${index}`,
            sectionName: section.sectionName,
            section,
          })),
        },
        ...((loadedDraft.payload.contactSections?.length ?? 0) > 0
          ? [
              {
                id: "contact",
                label: "Contact",
                sections: (loadedDraft.payload.contactSections ?? []).map((section, index) => ({
                  key: `contact:${index}`,
                  sectionName: section.sectionName,
                  section,
                })),
              },
            ]
          : []),
        ...Object.entries(loadedDraft.payload.marketingPages ?? {}).map(([pageKey, sections]) => ({
          id: `marketing:${pageKey}`,
          label: labelForMarketingPage(pageKey),
          sections: sections.map((section, index) => ({
            key: `marketing:${pageKey}:${index}`,
            sectionName: section.sectionName,
            section,
          })),
        })),
      ]
    : [];

  const origin = await getRequestOrigin();
  const publicSiteAbsoluteUrl = origin ? `${origin}/site/${encodeURIComponent(decoded)}` : `/site/${encodeURIComponent(decoded)}`;

  // Voor de theme-swatches: lees de "origineel"-config uit de cache zodat Donker/Warm-swatches
  // altijd worden afgeleid uit het onveranderde palet, niet uit een al-getransformeerde huidige draft.
  const originalPageConfig = loadedDraft.ok && draftPayload?.kind === "tailwind"
    ? await readOriginalPageConfigForSlug(decoded).catch(() => null)
    : null;

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Website &amp; domein</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pas hier je concept aan; daarna kun je live zetten en je domein volgen. Grote layoutwijzigingen of nieuwe
          blokken lopen via je studio.
        </p>
      </div>

      {loadedDraft.ok && draftPayload?.kind === "tailwind" ? (
        <PortalVisualSiteEditor
          slug={slug}
          clientName={client.name}
          documentTitle={loadedDraft.documentTitle ?? client.name}
          pages={editorPages}
          pageConfig={draftPayload.config}
          originalPageConfig={originalPageConfig ?? undefined}
          userCss={draftPayload.customCss}
          userJs={draftPayload.customJs}
          logoSet={draftPayload.logoSet}
          rasterBrandSet={draftPayload.rasterBrandSet}
          compiledTailwindCss={draftPayload.tailwindCompiledCss}
          publicSiteUrl={publicSiteAbsoluteUrl}
          designContract={draftPayload.designContract}
        />
      ) : (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Deze klant-editor werkt alleen voor Tailwind-sites met een modern project-snapshot. Legacy-sites of oudere
          concepten moeten eerst door de studio worden gemigreerd.
        </section>
      )}

      <div className="mt-10">
        <PortalWebsitePanel
          slug={slug}
          customDomain={client.custom_domain}
          domainVerified={client.domain_verified}
          domainDnsTarget={client.domain_dns_target}
        />
      </div>
    </main>
  );
}
