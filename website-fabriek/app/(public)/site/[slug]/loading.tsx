/** Directe feedback tijdens RSC + Supabase; Tailwind CDN kan daarna nog even nodig hebben voor styling. */
export default function PublicSiteSlugLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-50 text-zinc-600">
      <div
        className="size-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600"
        aria-hidden
      />
      <p className="text-sm">Site laden…</p>
    </div>
  );
}
