import Link from "next/link";
import { redirect } from "next/navigation";
import { resolvePortalHome } from "@/lib/portal/resolve-portal-home";

/**
 * Gedeelde logica voor /home en /dashboard: één portaal-koppeling → redirect, anders studio of keuzelijst.
 */
export async function PortalEntryPage() {
  const r = await resolvePortalHome();
  if (r.kind === "single") {
    redirect(`/portal/${encodeURIComponent(r.slug)}`);
  }
  if (r.kind === "none") {
    redirect("/admin/ops");
  }

  return (
    <main className="gentrix-ui-sharp mx-auto min-h-[50vh] max-w-lg px-4 py-12">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Meerdere portalen</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Je account is gekoppeld aan meer dan één klantdossier. Kies hieronder welk portaal je wilt openen.
      </p>
      <ul className="mt-6 space-y-2">
        {r.clients.map((c) => {
          const enc = encodeURIComponent(c.subfolder_slug);
          return (
            <li key={c.subfolder_slug}>
              <Link
                href={`/portal/${enc}`}
                className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
              >
                {c.name}
                <span className="mt-0.5 block font-mono text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  /portal/{c.subfolder_slug}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/admin/ops" className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
          Naar studio (admin)
        </Link>
      </p>
    </main>
  );
}
