import Link from "next/link";
import type { WebsiteOpsWithClient } from "@/lib/data/website-ops";

const STAGE_KEYS = [
  "briefing",
  "generating",
  "review",
  "revisions",
  "ready",
  "live",
] as const;

const SHORT: Record<(typeof STAGE_KEYS)[number], string> = {
  briefing: "Brief.",
  generating: "Gen.",
  review: "Rev.",
  revisions: "Revw.",
  ready: "Klaar",
  live: "Live",
};

const LABEL: Record<(typeof STAGE_KEYS)[number], string> = {
  briefing: "Briefing",
  generating: "Genereren",
  review: "Review",
  revisions: "Revisies",
  ready: "Klaar",
  live: "Live",
};

/**
 * Compacte samenvatting van website-fases op het commandocentrum.
 * Het volledige Kanban-bord staat alleen onder Operatie → Websites.
 */
export function OpsWebsiteDeliveryStrip({ items }: { items: WebsiteOpsWithClient[] }) {
  const notLive = items.filter((i) => i.ops_status !== "live").length;
  const counts = STAGE_KEYS.map((key) => ({
    key,
    short: SHORT[key],
    n: items.filter((i) => i.ops_status === key).length,
  }));

  return (
    <section
      aria-label="Website-fases"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-neutral-200/80 bg-neutral-50/50 px-3 py-2 dark:border-zinc-700/80 dark:bg-zinc-900/40"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-700 dark:text-zinc-300">
        <span className="font-semibold text-neutral-900 dark:text-zinc-100">Websites</span>
        <span className="hidden text-neutral-300 sm:inline dark:text-zinc-600" aria-hidden>
          |
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {counts.map(({ key, short, n }) => (
            <span key={key} className="tabular-nums" title={`${LABEL[key]}: ${n}`}>
              <span className="text-neutral-400 dark:text-zinc-500">{short}</span>
              {n}
            </span>
          ))}
        </span>
        {items.length > 0 ? (
          <span className="text-neutral-500 dark:text-zinc-400">· {notLive} niet live</span>
        ) : null}
      </div>
      <Link
        href="/admin/ops/websites#levering"
        className="shrink-0 text-[11px] font-semibold text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-950 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-300"
      >
        Fase-bord →
      </Link>
    </section>
  );
}
