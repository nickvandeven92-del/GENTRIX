"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { WebsiteOpsWithClient } from "@/lib/data/website-ops";
import { ExternalLink, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const OPS_STATUSES = [
  "briefing",
  "generating",
  "review",
  "revisions",
  "ready",
  "live",
] as const;

const OPS_STATUS_LABELS: Record<(typeof OPS_STATUSES)[number], string> = {
  briefing: "Briefing",
  generating: "Genereren",
  review: "Review",
  revisions: "Revisies",
  ready: "Klaar",
  live: "Live",
};

const COL_WIDTH = "min-w-[200px] w-[200px] sm:min-w-[220px] sm:w-[220px] md:min-w-[240px] md:w-[240px]";

export function WebsiteProductionBoard({ items }: { items: WebsiteOpsWithClient[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function patchOps(clientId: string, body: Record<string, unknown>) {
    setBusy(clientId);
    try {
      const res = await fetch(`/api/admin/sales-os/website-ops/${clientId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const byStage = (s: string) => items.filter((i) => i.ops_status === s);

  const selectClass =
    "mt-2 w-full rounded-md border-0 bg-neutral-100/80 py-1.5 pl-2 text-[11px] text-neutral-900 focus:ring-1 focus:ring-neutral-950/15";

  return (
    <section
      id="levering"
      aria-label="Website-levering"
      title="Operationele status (website_ops_state); horizontaal scrollen binnen dit blok."
      className="scroll-mt-8 min-w-0 space-y-2"
    >
      <div>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Websites</h2>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-950 md:text-xl">Levering</p>
        <p className="mt-0.5 max-w-lg text-xs leading-snug text-neutral-500">
          Van briefing tot live; scroll horizontaal in het bord hieronder.
        </p>
      </div>

      {/* Scroll alleen hier: min-w-0 + max-w-full voorkomt pagina-breedte-uitloop */}
      <div className="sales-os-board-shell min-w-0 max-w-full rounded-2xl bg-neutral-50/60 p-1 ring-1 ring-neutral-950/[0.05]">
        <div
          className="sales-os-scroll-x max-w-full overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1"
          role="region"
          aria-label="Website-levering per fase"
        >
          <div className="flex w-max gap-0 pr-2">
            {OPS_STATUSES.map((stage) => {
              const col = byStage(stage);
              return (
                <div
                  key={stage}
                  className={cn(
                    COL_WIDTH,
                    "shrink-0 border-l border-neutral-200/50 px-3 first:border-l-0 first:pl-2",
                  )}
                >
                  <div className="mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-zinc-500">
                      {OPS_STATUS_LABELS[stage]}
                    </p>
                    <p className="text-[11px] tabular-nums text-neutral-500 dark:text-zinc-400">{col.length}</p>
                  </div>
                  <div
                    className={cn(
                      "flex max-h-[min(60vh,420px)] flex-col gap-1.5 overflow-y-auto pr-0.5 sales-os-scroll-x",
                      col.length > 4 && "pb-1",
                    )}
                  >
                    {col.map((w) => (
                      <article
                        key={w.id}
                        className="sales-os-card-glass shrink-0 rounded-lg bg-white p-2.5 ring-1 ring-neutral-950/[0.06] transition-shadow hover:ring-neutral-950/[0.1]"
                      >
                        <Link
                          href={`/admin/editor/${encodeURIComponent(w.subfolder_slug)}`}
                          className="text-[10px] font-semibold text-neutral-950 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-950 dark:text-zinc-50 dark:decoration-zinc-500 dark:hover:decoration-zinc-200"
                        >
                          Editor
                        </Link>
                        <p className="mt-2 text-[13px] font-semibold leading-snug text-neutral-950 dark:text-zinc-50">{w.client_name}</p>
                        <p className="truncate font-mono text-[10px] text-neutral-500 dark:text-zinc-400">
                          {w.custom_domain || w.subfolder_slug || "—"}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                          <div>
                            <p className="text-[9px] text-neutral-400">Kwal.</p>
                            <p className="text-[11px] font-semibold tabular-nums text-neutral-800">
                              {w.quality_score ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-neutral-400">Tekst</p>
                            <p className="text-[11px] font-semibold tabular-nums text-neutral-800">
                              {w.content_completeness ?? "—"}
                              {w.content_completeness != null ? "%" : ""}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-neutral-400">Media</p>
                            <p className="text-[11px] font-semibold tabular-nums text-neutral-800">
                              {w.media_completeness ?? "—"}
                              {w.media_completeness != null ? "%" : ""}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] text-neutral-500">
                          Review {w.review_status} · Blokkade {w.blocker_status}
                        </p>
                        <label className="sr-only" htmlFor={`ops-${w.id}`}>
                          Levering {w.client_name}
                        </label>
                        <select
                          id={`ops-${w.id}`}
                          disabled={busy === w.client_id}
                          value={w.ops_status}
                          onChange={(e) => void patchOps(w.client_id, { ops_status: e.target.value })}
                          className={cn(selectClass, busy === w.client_id && "opacity-50")}
                        >
                          {OPS_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {OPS_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          <Link
                            href={`/site/${encodeURIComponent(w.subfolder_slug)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-700 hover:text-neutral-950"
                          >
                            <ExternalLink className="size-2.5 opacity-60" />
                            Preview
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              void patchOps(w.client_id, {
                                blocker_status: "none",
                                blocker_reason: null,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-700 hover:text-neutral-950"
                          >
                            <Wrench className="size-2.5 opacity-60" />
                            Blokkade wissen
                          </button>
                          <PublishButton subfolderSlug={w.subfolder_slug} />
                        </div>
                      </article>
                    ))}
                    {col.length === 0 ? <p className="py-2 text-center text-[10px] text-neutral-300">—</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function PublishButton({ subfolderSlug }: { subfolderSlug: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function publish() {
    setMsg(null);
    const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/publish`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    setMsg(j.ok ? "Gepubliceerd." : j.error ?? "Mislukt");
  }
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => void publish()}
        className="text-[10px] font-semibold text-emerald-800 hover:text-emerald-950"
      >
        Publiceren
      </button>
      {msg ? <p className="mt-1 text-[9px] text-neutral-500">{msg}</p> : null}
    </div>
  );
}
