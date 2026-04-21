import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalVisualSiteEditor } from "@/components/portal/portal-visual-site-editor";
import { PortalWebsitePanel } from "@/components/portal/portal-website-panel";
import { getDraftPublishedSitePayloadBySlug, getDraftSiteJsonBySlug } from "@/lib/data/client-draft-site";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
import { loadTailwindPayloadFromDraftJson } from "@/lib/portal/portal-draft-section-mutate";
import { getRequestOrigin } from "@/lib/site/request-origin";

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

  const origin = await getRequestOrigin();
  const publicSiteAbsoluteUrl = origin ? `${origin}/site/${encodeURIComponent(decoded)}` : `/site/${encodeURIComponent(decoded)}`;

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
          sections={loadedDraft.payload.sections.map((section, index) => ({
            key: `main:${index}`,
            sectionName: section.sectionName,
            section,
          }))}
          pageConfig={draftPayload.config}
          userCss={draftPayload.customCss}
          userJs={draftPayload.customJs}
          logoSet={draftPayload.logoSet}
          compiledTailwindCss={draftPayload.tailwindCompiledCss}
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
          draftSnapshotId={client.draft_snapshot_id}
          publishedSnapshotId={client.published_snapshot_id}
          customDomain={client.custom_domain}
          domainVerified={client.domain_verified}
          domainDnsTarget={client.domain_dns_target}
          publicSiteAbsoluteUrl={publicSiteAbsoluteUrl}
        />
      </div>
    </main>
  );
}
