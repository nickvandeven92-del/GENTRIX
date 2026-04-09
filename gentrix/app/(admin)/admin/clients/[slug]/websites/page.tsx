import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Code2, ExternalLink, FolderOpen, PanelTop } from "lucide-react";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { getWebsiteOpsByClientId } from "@/lib/data/website-ops";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Live";
    case "draft":
      return "Concept";
    case "paused":
      return "Gepauzeerd";
    case "archived":
      return "Archief";
    default:
      return status;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Websites" };
  return { title: `Websites — ${row.name}` };
}

export default async function ClientWebsitesPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const ops = await getWebsiteOpsByClientId(row.id);
  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;

  const cardBtn =
    "inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-900";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Websites</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Site, editor en leveringsstatus.</p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Hoofdsite</h3>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Publicatiestatus</dt>
            <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{statusLabel(row.status)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Gewenst domein</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">{row.custom_domain || "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/site/${enc}`} target="_blank" rel="noreferrer" className={cn(cardBtn)}>
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            Live site
          </Link>
          <Link href={`/admin/editor/${enc}`} className={cn(cardBtn, "border-blue-200 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/30")}>
            <Code2 className="size-4 shrink-0" aria-hidden />
            HTML-editor
          </Link>
          <Link href={`${base}/preview`} className={cardBtn}>
            <FolderOpen className="size-4 shrink-0" aria-hidden />
            Concept-preview
          </Link>
          <Link href={`${base}/snapshots`} className={cardBtn}>
            Snapshots
          </Link>
          <Link
            href={`/admin/ops/studio?slug=${enc}`}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            <PanelTop className="size-4 shrink-0" aria-hidden />
            Site studio
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Operatie (levering)</h3>
        {ops ? (
          <dl className="mt-4 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div>
              <dt className="inline text-zinc-500">Levering: </dt>
              <dd className="inline">{ops.ops_status}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Review: </dt>
              <dd className="inline">{ops.review_status}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Blokkade: </dt>
              <dd className="inline">{ops.blocker_status}</dd>
            </div>
            <div>
              <dt className="inline text-zinc-500">Publicatie klaar: </dt>
              <dd className="inline">{ops.publish_ready ? "Ja" : "Nee"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Nog geen operatie-record voor deze klant.</p>
        )}
      </section>

      <p className="text-sm text-zinc-500">
        <Link href={`${base}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
          ← Terug naar overzicht
        </Link>
      </p>
    </div>
  );
}
