"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SalesTaskRow } from "@/lib/data/sales-tasks";
import { cn } from "@/lib/utils";

function priorityNl(p: string) {
  const m: Record<string, string> = {
    urgent: "Urgent",
    high: "Hoog",
    normal: "Normaal",
    low: "Laag",
  };
  return m[p] ?? p;
}

function entityNl(t: string) {
  const m: Record<string, string> = {
    lead: "Lead",
    deal: "Deal",
    client: "Klant",
    website: "Website",
  };
  return m[t] ?? t;
}

type OpsOpenTasksProps = {
  tasks: SalesTaskRow[];
  /** Cockpit: geen zware card-rand; één rustige zone. */
  variant?: "default" | "cockpit";
};

export function OpsOpenTasks({ tasks, variant = "default" }: OpsOpenTasksProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const cockpit = variant === "cockpit";

  async function complete(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/sales-os/tasks/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      const j = (await res.json()) as { ok?: boolean };
      if (j.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const shell = cockpit
    ? "rounded-lg bg-neutral-50/30 py-3 ring-1 ring-neutral-950/[0.04]"
    : "overflow-hidden rounded-lg border border-neutral-200/70 bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]";

  const headBorder = cockpit ? "" : "border-b border-neutral-200";
  const headPad = cockpit ? "px-4 pb-2" : "border-b border-neutral-200 px-4 py-3";
  const listPad = cockpit ? "px-4" : "px-4";

  if (tasks.length === 0) {
    return (
      <section className={shell}>
        <div className={cn(headPad, !cockpit && headBorder)}>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Openstaande taken</h2>
          <p className="mt-2 text-[15px] font-medium text-neutral-900">Geen open taken</p>
          <p className="mt-1 text-[12px] text-neutral-500">
            Voeg toe via Taken of de API — nog geen sales_tasks met status open.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div className={cn(headPad, !cockpit && headBorder)}>
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Openstaande taken</h2>
        <p className="mt-1 text-[12px] text-neutral-500">Prioriteit en deadline · voltooien schrijft naar de database.</p>
      </div>
      <ul className={cn("divide-y divide-neutral-100/90", listPad)}>
        {tasks.map((t) => (
          <li key={t.id} className="py-3.5 first:pt-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                    {entityNl(t.linked_entity_type)}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      t.priority === "urgent" || t.priority === "high" ? "text-rose-600" : "text-neutral-400",
                    )}
                  >
                    {priorityNl(t.priority)}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] font-medium leading-snug text-neutral-900">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">{t.description}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-neutral-500">
                  Deadline: {t.due_at ? new Date(t.due_at).toLocaleString("nl-NL") : "—"} ·{" "}
                  {t.owner_label ?? "Geen eigenaar"}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => void complete(t.id)}
                className="sales-os-glass-primary-btn shrink-0 rounded-lg border border-transparent bg-neutral-950 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {busy === t.id ? "…" : "Voltooien"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
