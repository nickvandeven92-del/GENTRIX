"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SalesTaskRow } from "@/lib/data/sales-tasks";

export function ClientTasksMini({ tasks }: { tasks: SalesTaskRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

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

  if (tasks.length === 0) {
    return <p className="text-[12px] text-neutral-500">Geen taken gekoppeld aan deze klant.</p>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2">
          <span className="text-[13px] text-neutral-900">{t.title}</span>
          {t.status === "open" ? (
            <button
              type="button"
              disabled={busy === t.id}
              onClick={() => void complete(t.id)}
              className="text-[10px] font-semibold text-neutral-900 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Voltooien
            </button>
          ) : (
            <span className="text-[10px] text-neutral-500">{t.status}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
