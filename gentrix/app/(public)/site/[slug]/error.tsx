"use client";

import { useEffect } from "react";

/**
 * Vangt runtime-fouten op /site/[slug] (Vercel 500) en toont iets leesbaars i.p.v. alleen de generieke Vercel-pagina.
 */
export default function PublicSiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/site] render error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Deze site laadt niet</h1>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Er ging iets mis bij het opbouwen van de pagina. Controleer in Vercel of de omgevingsvariabelen{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">NEXT_PUBLIC_SUPABASE_*</code> en{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        kloppen, en bekijk de deployment logs.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        Opnieuw proberen
      </button>
    </div>
  );
}
