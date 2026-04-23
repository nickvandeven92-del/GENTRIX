"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Summary = {
  totalAwaiting: number;
  slugAwaiting: number;
};

type Props = {
  subfolderSlug: string;
  className?: string;
  /** Poll-interval (ms). */
  pollMs?: number;
};

export function StudioSupportStrip({ subfolderSlug, className, pollMs = 45_000 }: Props) {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    try {
      const enc = encodeURIComponent(subfolderSlug);
      const res = await fetch(`/api/admin/support-inbox-summary?slug=${enc}`, { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; totalAwaiting?: number; slugAwaiting?: number };
      if (!res.ok || !j?.ok) {
        setErr(true);
        return;
      }
      setErr(false);
      setData({ totalAwaiting: j.totalAwaiting ?? 0, slugAwaiting: j.slugAwaiting ?? 0 });
    } catch {
      setErr(true);
    }
  }, [subfolderSlug]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    const t = window.setInterval(() => void load(), pollMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, pollMs]);

  if (err || data === null) {
    return null;
  }

  if (data.slugAwaiting === 0 && data.totalAwaiting === 0) {
    return null;
  }

  const enc = encodeURIComponent(subfolderSlug);
  const dossierHref = `/admin/clients/${enc}#client-support-chat`;
  const inboxHref = "/admin/ops/support-inbox";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-amber-200/90 bg-amber-50/95 px-2 py-1 text-[11px] text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
        className,
      )}
    >
      <MessageCircle className="size-3.5 shrink-0 opacity-80" aria-hidden />
      {data.slugAwaiting > 0 ? (
        <>
          <span className="min-w-0 font-medium">
            {data.slugAwaiting === 1
              ? "1 openstaande klantvraag voor deze site."
              : `${data.slugAwaiting} openstaande klantvragen voor deze site.`}
          </span>
          <Link
            href={dossierHref}
            className="shrink-0 font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-50"
          >
            Antwoorden in dossier
          </Link>
        </>
      ) : (
        <span className="min-w-0 text-amber-900/85 dark:text-amber-200/90">
          Geen open vragen voor deze klant — elders nog{" "}
          <span className="font-semibold tabular-nums">{data.totalAwaiting}</span> in de inbox.
        </span>
      )}
      {data.totalAwaiting > 0 ? (
        <Link
          href={inboxHref}
          className="ml-auto shrink-0 rounded border border-amber-300/80 bg-white/90 px-1.5 py-0.5 font-medium text-amber-950 hover:bg-white dark:border-amber-800 dark:bg-zinc-900/80 dark:text-amber-100 dark:hover:bg-zinc-900"
        >
          Inbox ({data.totalAwaiting})
        </Link>
      ) : null}
    </div>
  );
}
