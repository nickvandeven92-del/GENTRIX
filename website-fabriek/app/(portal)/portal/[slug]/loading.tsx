export default function PortalSlugLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-100 text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
      <div
        className="size-10 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-300"
        aria-hidden
      />
      <p className="text-sm">Portaal laden…</p>
    </div>
  );
}
