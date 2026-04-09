"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOpt = { id: string; name: string };

export function CreateTaskForm({ clients }: { clients: ClientOpt[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) {
      setErr("Titel verplicht.");
      return;
    }
    if (!clientId) {
      setErr("Kies een klant (koppeling als website/client-entity).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/sales-os/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          due_at: due ? new Date(due).toISOString() : null,
          linked_entity_type: "client",
          linked_entity_id: clientId,
          source_type: "manual",
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!j.ok) {
        setErr(j.error ?? "Mislukt.");
        return;
      }
      setTitle("");
      setDue("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mb-8 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-neutral-900">Nieuwe taak</h3>
      <p className="mt-0.5 text-[11px] text-neutral-500">Gekoppeld aan klant (UUID) — slaat op in sales_tasks.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        />
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        >
          <option value="low">Laag</option>
          <option value="normal">Normaal</option>
          <option value="high">Hoog</option>
          <option value="urgent">Urgent</option>
        </select>
        <input
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
        />
        <button
          type="submit"
          disabled={busy}
          className="sales-os-glass-primary-btn rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {busy ? "…" : "Aanmaken"}
        </button>
      </div>
      {err ? <p className="mt-2 text-xs text-rose-600">{err}</p> : null}
    </form>
  );
}
