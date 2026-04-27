import { cn } from "@/lib/utils";

/** Zelfde focusring als Sales OS-zoekveld (sales-os-shell). */
export const salesOsInputFocusClass =
  "focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/15";

/** Standaard tekstveld in Sales OS-popovers / auth. */
export function salesOsTextInputClass(className?: string) {
  return cn(
    "w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-100 dark:placeholder:text-zinc-500",
    salesOsInputFocusClass,
    className,
  );
}

/** Primaire knop zoals “Snelle acties” in sales-os topbar. */
export const salesOsPrimaryButtonClass =
  "inline-flex w-full items-center justify-center rounded-md border border-transparent bg-neutral-950 px-3 py-2.5 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
