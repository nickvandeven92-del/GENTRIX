"use client";

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { GeneratorStudioFaqContent } from "@/components/admin/generator-studio-faq-content";

/** Compacte knop + modal met volledige FAQ (Site-studio generatie). */
export function GeneratorStudioFaqLauncher({
  className,
  iconOnly = false,
}: {
  className?: string;
  /** Alleen pictogram (compacte toolbar). */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="FAQ generatie"
        aria-label="FAQ generatie"
        className={
          className ??
          (iconOnly
            ? "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            : "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50")
        }
      >
        <HelpCircle className="size-3.5 shrink-0" aria-hidden />
        {iconOnly ? <span className="sr-only">FAQ generatie</span> : "FAQ generatie"}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[min(85vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-950"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-faq-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="studio-faq-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                FAQ generatie
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label="Sluiten"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4">
              <GeneratorStudioFaqContent />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
