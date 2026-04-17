import { cn } from "@/lib/utils";

type PublicSitePageSkeletonProps = {
  className?: string;
  /** `true` = compacte hoogte (embedded / portal); anders vult de shell de beschikbare hoogte. */
  embedded?: boolean;
};

/**
 * Neutrale “site chrome” tijdens korte laadfase (RSC + iframe-srcDoc).
 * Geen spinner — oogt rustiger en minder “foutmelding” bij ~1s waits.
 */
export function PublicSitePageSkeleton({ className, embedded = false }: PublicSitePageSkeletonProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col bg-white text-zinc-400",
        embedded ? "min-h-[min(72vh,720px)]" : "min-h-0 flex-1",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Pagina wordt geladen</span>
      <header className="shrink-0 border-b border-zinc-100 bg-white/95 px-4 py-3.5 backdrop-blur-sm">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-6">
          <div className="h-7 w-[7.5rem] animate-pulse rounded-md bg-zinc-100" aria-hidden />
          <div className="hidden items-center gap-5 sm:flex" aria-hidden>
            <div className="h-2.5 w-14 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-2.5 w-16 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-2.5 w-12 animate-pulse rounded-full bg-zinc-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-zinc-100" />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4 py-10 sm:py-14">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10">
          <div className="space-y-4">
            <div className="h-10 max-w-[18rem] animate-pulse rounded-lg bg-zinc-100 sm:max-w-md" aria-hidden />
            <div className="h-4 max-w-xl animate-pulse rounded bg-zinc-100/80" aria-hidden />
            <div className="h-4 max-w-lg animate-pulse rounded bg-zinc-100/70" aria-hidden />
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="h-11 w-36 animate-pulse rounded-lg bg-zinc-100" aria-hidden />
              <div className="h-11 w-32 animate-pulse rounded-lg bg-zinc-50" aria-hidden />
            </div>
          </div>
          <div
            className="min-h-[12rem] flex-1 animate-pulse rounded-2xl bg-gradient-to-b from-zinc-50 to-zinc-100/80 sm:min-h-[14rem]"
            aria-hidden
          />
        </div>
      </main>
    </div>
  );
}
