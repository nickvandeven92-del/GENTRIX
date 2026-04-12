import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listPortalClientsLinkedToUser } from "@/lib/data/list-portal-clients-for-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Klantportaal",
};

export default async function PortalIndexPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    redirect("/login?next=%2Fportal");
  }

  const clients = await listPortalClientsLinkedToUser();
  if (clients.length === 1) {
    redirect(`/portal/${encodeURIComponent(clients[0].subfolder_slug)}`);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Klantportaal</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Kies je dossier. Ontvang je geen bedrijven hieronder, log dan in met het account uit je uitnodigingsmail.
      </p>
      {clients.length === 0 ? (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Geen actieve koppeling gevonden. Neem contact op met je studio als dit niet klopt.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {clients.map((c) => {
            const enc = encodeURIComponent(c.subfolder_slug);
            return (
              <li key={c.subfolder_slug}>
                <Link
                  href={`/portal/${enc}`}
                  className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
                >
                  {c.name.trim() || c.subfolder_slug}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
