import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalDraftSectionsEditor } from "@/components/portal/portal-draft-sections-editor";
import { PortalWebsitePanel } from "@/components/portal/portal-website-panel";
import { getActivePortalClient } from "@/lib/data/get-portal-client";
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

      <PortalDraftSectionsEditor slug={slug} />

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
