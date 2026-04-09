import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listClientActivityForDossier, type ClientActivityItem } from "@/lib/data/list-client-activity-for-dossier";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

const KIND_DOT: Record<ClientActivityItem["kind"], string> = {
  invoice_audit: "bg-blue-500",
  site_generation: "bg-emerald-500",
  appointment: "bg-violet-500",
  subscription: "bg-amber-500",
};

const KIND_LABEL: Record<ClientActivityItem["kind"], string> = {
  invoice_audit: "Factuur",
  site_generation: "Site",
  appointment: "Afspraak",
  subscription: "Portaal",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Activiteit" };
  return { title: `Activiteit — ${row.name}` };
}

export default async function ClientActivityPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const enc = encodeURIComponent(row.subfolder_slug);
  const base = `/admin/clients/${enc}`;

  const { items: events, error: activityError } = await listClientActivityForDossier(row.id, { limit: 100 });
  const serviceKeyMissing = activityError === "missing_service_role";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Activiteit</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Tijdlijn: factuuraudit, site-generaties, afspraken en opzegging via portaal. Nieuwere gebeurtenissen bovenaan.
        </p>
      </div>

      {serviceKeyMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100">
          <p className="font-medium">Geen activiteitsdata geladen</p>
          <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/90">
            Zet <code className="rounded bg-white/80 px-1 font-mono text-[11px] dark:bg-zinc-900">SUPABASE_SERVICE_ROLE_KEY</code> in
            je server-omgeving (lokaal <code className="rounded bg-white/80 px-1 font-mono text-[11px] dark:bg-zinc-900">.env.local</code>, op Vercel
            onder Project Settings → Environment Variables). Key staat in Supabase onder Project Settings → API. Zonder service role blijft deze
            lijst leeg.
          </p>
        </div>
      ) : null}

      {events.length === 0 && !serviceKeyMissing ? (
        <p className="rounded-xl border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Nog geen geregistreerde gebeurtenissen voor deze klant.
        </p>
      ) : null}

      {events.length > 0 ? (
        <ol className="relative space-y-6 border-l border-zinc-200 pl-6 dark:border-zinc-700">
          {events.map((ev) => (
            <li key={ev.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white dark:border-zinc-950",
                  KIND_DOT[ev.kind],
                )}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="mr-2 font-medium text-zinc-600 dark:text-zinc-300">{KIND_LABEL[ev.kind]}</span>
                {new Date(ev.at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
              </p>
              {ev.href ? (
                <Link
                  href={ev.href}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                >
                  {ev.title}
                </Link>
              ) : (
                <p className="font-medium text-zinc-900 dark:text-zinc-50">{ev.title}</p>
              )}
              {ev.detail ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{ev.detail}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}

      <p className="text-sm text-zinc-500">
        <Link href={`${base}`} className="font-medium text-zinc-700 hover:underline dark:text-zinc-300">
          ← Terug naar overzicht
        </Link>
      </p>
    </div>
  );
}
