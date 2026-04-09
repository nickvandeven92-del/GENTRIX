"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SalesTaskRow } from "@/lib/data/sales-tasks";
import { bucketOpenTasks } from "@/lib/sales-os/task-buckets";
import { cn } from "@/lib/utils";

function entityNl(t: string) {
  const m: Record<string, string> = {
    lead: "Lead",
    deal: "Deal",
    client: "Klant",
    website: "Website",
  };
  return m[t] ?? t;
}

function TaskLine({ t, onDone }: { t: SalesTaskRow; onDone: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2">
      <div className="min-w-0">
        <p className="text-[13px] text-neutral-900">{t.title}</p>
        <p className="text-[10px] text-neutral-500">
          {entityNl(t.linked_entity_type)} · {t.due_at ? new Date(t.due_at).toLocaleString("nl-NL") : "geen datum"} ·{" "}
          {t.source_type}
        </p>
      </div>
      {t.status === "open" ? (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDone(t.id);
            setBusy(false);
          }}
          className="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold text-neutral-900 hover:border-neutral-300 hover:bg-neutral-50"
        >
          Voltooien
        </button>
      ) : (
        <span className="text-[10px] text-neutral-500">{t.status}</span>
      )}
    </li>
  );
}

export function TasksBoardClient({ tasks }: { tasks: SalesTaskRow[] }) {
  const router = useRouter();
  const done = tasks.filter((t) => t.status === "done").slice(0, 30);
  const { overdue, today, week, later } = bucketOpenTasks(tasks);
  const auto = tasks.filter((t) => t.status === "open" && t.source_type !== "manual");
  const delegated: SalesTaskRow[] = [];

  async function complete(id: string) {
    const res = await fetch(`/api/admin/sales-os/tasks/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    const j = (await res.json()) as { ok?: boolean };
    if (j.ok) router.refresh();
  }

  function Section({ title, rows }: { title: string; rows: SalesTaskRow[] }) {
    return (
      <section className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-2">
          <h2 className="text-xs font-semibold uppercase text-neutral-500">{title}</h2>
          <p className="text-[10px] text-neutral-500">{rows.length} item(s)</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12px] text-neutral-400">—</p>
        ) : (
          <ul className="px-4 py-1">
            {rows.map((t) => (
              <TaskLine key={t.id} t={t} onDone={complete} />
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <Section title="Te laat" rows={overdue} />
      <Section title="Vandaag" rows={today} />
      <Section title="Deze week" rows={week} />
      <Section title="Later / geen deadline" rows={later} />
      <Section title="Automatisch / regel / systeem (open)" rows={auto} />
      <Section title="Gedelegeerd (eigenaar ≠ jij — nog niet geïmplementeerd)" rows={delegated} />
      <section className={cn("rounded-lg border border-neutral-200 bg-white")}>
        <div className="border-b border-neutral-200 px-4 py-2">
          <h2 className="text-xs font-semibold uppercase text-neutral-500">Recent afgerond</h2>
        </div>
        <ul className="px-4 py-1">
          {done.map((t) => (
            <li key={t.id} className="border-b border-neutral-100 py-2 text-[12px] text-neutral-500">
              {t.title}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
