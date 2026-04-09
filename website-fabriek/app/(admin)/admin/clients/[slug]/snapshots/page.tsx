import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteSnapshotsTooling } from "@/components/admin/site-snapshots-tooling";
import { getAdminClientBySlug } from "@/lib/data/get-admin-client-by-slug";
import { formatSlugForDisplay } from "@/lib/slug";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  const row = await getAdminClientBySlug(decoded);
  const label = row?.name?.trim() || formatSlugForDisplay(decoded);
  return { title: `Snapshots · ${label}` };
}

/** Fase 4: rollback, diff, labels — admin only. */
export default async function ClientSnapshotsPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getAdminClientBySlug(decoded);
  if (!row) notFound();

  const enc = encodeURIComponent(row.subfolder_slug);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Site-snapshots</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {row.name} — <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">{row.subfolder_slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link href={`/admin/clients/${enc}`} className="text-blue-800 underline dark:text-blue-400">
            Dossier
          </Link>
          <Link href={`/admin/editor/${enc}`} className="text-blue-800 underline dark:text-blue-400">
            Editor
          </Link>
          <Link href={`/admin/clients/${enc}/preview`} className="text-blue-800 underline dark:text-blue-400">
            Concept-preview
          </Link>
        </div>
      </div>

      <SiteSnapshotsTooling subfolderSlug={row.subfolder_slug} />
    </div>
  );
}
