"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

type Props = {
  businessName: string;
  /** Pad op dezelfde origin, bv. `/booking-app/book/mosham`. */
  iframeSrc: string;
};

/**
 * Volledige viewport: dunne kop + iframe met de Vite boek-SPA.
 * Bedoeld voor `window.open(…/boek-venster/{slug})` — geen ruimte nodig op de marketingpagina.
 */
export function BookingVensterFrame({ businessName, iframeSrc }: Props) {
  useEffect(() => {
    document.title = `Afspraak — ${businessName}`;
  }, [businessName]);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <span className="min-w-0 truncate text-sm font-semibold">Afspraak maken — {businessName}</span>
        <button
          type="button"
          onClick={() => {
            window.close();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
        >
          <X className="size-3.5" aria-hidden />
          Sluiten
        </button>
      </header>
      <iframe title={`Online boeken — ${businessName}`} src={iframeSrc} className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  );
}
