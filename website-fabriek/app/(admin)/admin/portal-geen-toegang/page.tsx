import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Geen toegang tot klantportaal",
};

type Props = { searchParams: Promise<{ slug?: string }> };

/**
 * Wordt getoond wanneer iemand /portal/{slug} opent maar niet de gekoppelde klant
 * (of studio-preview-UUID) is — i.p.v. een stille redirect die lijkt alsof de link “niets doet”.
 */
export default async function PortalGeenToegangPage({ searchParams }: Props) {
  const sp = await searchParams;
  const slug = sp.slug?.trim();

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Geen toegang tot dit klantportaal</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Je bent ingelogd in de studio, maar met <strong className="text-zinc-800 dark:text-zinc-200">strikt portaal</strong> mag
        alleen de <strong className="text-zinc-800 dark:text-zinc-200">gekoppelde klant-login</strong> (of een ingestelde
        studio-UUID) dit portaal openen. Daarom werd je niet naar het portaal gebracht.
      </p>
      {slug ? (
        <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
          Slug: <span className="text-zinc-700 dark:text-zinc-300">{slug}</span>
        </p>
      ) : null}
      <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Lokaal voorbeeld:</strong> zet in{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">.env.local</code> tijdelijk{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">PORTAL_STRICT_ACCESS=0</code> en herstart{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run dev</code>.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Studio blijft strikt:</strong> zet je Supabase Auth user-UUID
          in <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">PORTAL_STUDIO_PREVIEW_USER_IDS</code>{" "}
          (komma-gescheiden). Die UUID vind je in Supabase → Authentication → Users.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Echte klant:</strong> log in met het account dat bij dit dossier
          hoort (uitnodiging / portal_user_id).
        </li>
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/clients"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Terug naar klanten
        </Link>
        <Link
          href="/admin/ops"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Studio-dashboard
        </Link>
      </div>
    </div>
  );
}
