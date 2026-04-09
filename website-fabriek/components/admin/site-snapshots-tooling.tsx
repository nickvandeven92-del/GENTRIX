"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SnapRow = {
  id: string;
  created_at: string;
  source: string;
  label: string | null;
  notes: string | null;
  created_by: string | null;
  parent_snapshot_id: string | null;
};

type ListResponse = {
  ok: true;
  data: {
    draft_snapshot_id: string | null;
    published_snapshot_id: string | null;
    snapshots: SnapRow[];
  };
};

export function SiteSnapshotsTooling({ subfolderSlug }: { subfolderSlug: string }) {
  const base = `/api/clients/${encodeURIComponent(subfolderSlug)}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ListResponse["data"] | null>(null);
  const [diffLeft, setDiffLeft] = useState("");
  const [diffRight, setDiffRight] = useState("");
  const [diffText, setDiffText] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/snapshots`);
      const json = (await res.json()) as ListResponse | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError(!json.ok ? json.error : "Laden mislukt.");
        return;
      }
      setData(json.data);
    } catch {
      setError("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function rollback(snapshotId: string) {
    if (!confirm("Concept terugzetten naar deze snapshot? Live site blijft ongewijzigd.")) return;
    setBusyId(snapshotId);
    setError(null);
    try {
      const res = await fetch(`${base}/snapshots/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot_id: snapshotId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Rollback mislukt.");
        return;
      }
      await load();
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusyId(null);
    }
  }

  async function saveMeta(snapshotId: string, label: string, notes: string) {
    setBusyId(snapshotId);
    setError(null);
    try {
      const res = await fetch(`${base}/snapshots/${encodeURIComponent(snapshotId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || null, notes: notes || null }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Opslaan mislukt.");
        return;
      }
      await load();
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusyId(null);
    }
  }

  async function runDiff() {
    setDiffText(null);
    if (!diffLeft || !diffRight || diffLeft === diffRight) {
      setError("Kies twee verschillende snapshot-id’s voor diff.");
      return;
    }
    setBusyId("diff");
    setError(null);
    try {
      const url = `${base}/snapshots/diff?left=${encodeURIComponent(diffLeft)}&right=${encodeURIComponent(diffRight)}`;
      const res = await fetch(url);
      const json = (await res.json()) as
        | {
            ok: true;
            data: {
              identical: boolean;
              leftLineCount: number;
              rightLineCount: number;
              changes: { leftLine: number; rightLine: number; leftText: string; rightText: string }[];
            };
          }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setError(!json.ok ? json.error : "Diff mislukt.");
        return;
      }
      setDiffText(JSON.stringify(json.data, null, 2));
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Snapshots laden…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Concept-pointer:</span>{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            {data?.draft_snapshot_id ?? "—"}
          </code>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Live-pointer:</span>{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">
            {data?.published_snapshot_id ?? "—"}
          </code>
        </div>
        <Link
          href={`/admin/clients/${encodeURIComponent(subfolderSlug)}/preview`}
          className="font-medium text-blue-800 underline dark:text-blue-400"
        >
          Open concept-preview
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Diff (canoniek JSON)</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Twee snapshot-id’s uit de tabel; eerste wijzigingen per regel (max. 80 hunks).
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            Links
            <input
              value={diffLeft}
              onChange={(e) => setDiffLeft(e.target.value)}
              className="mt-1 block w-72 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="uuid"
            />
          </label>
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            Rechts
            <input
              value={diffRight}
              onChange={(e) => setDiffRight(e.target.value)}
              className="mt-1 block w-72 rounded border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              placeholder="uuid"
            />
          </label>
          <button
            type="button"
            disabled={busyId === "diff"}
            onClick={() => void runDiff()}
            className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
          >
            {busyId === "diff" ? "Bezig…" : "Diff ophalen"}
          </button>
        </div>
        {diffText && (
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">{diffText}</pre>
        )}
      </section>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">Tijd (UTC)</th>
              <th className="px-3 py-2">Bron</th>
              <th className="px-3 py-2">created_by</th>
              <th className="px-3 py-2">Label / notities</th>
              <th className="px-3 py-2">Acties</th>
            </tr>
          </thead>
          <tbody>
            {(data?.snapshots ?? []).map((s) => (
              <SnapshotRow
                key={s.id}
                row={s}
                isDraft={s.id === data?.draft_snapshot_id}
                isPublished={s.id === data?.published_snapshot_id}
                busy={busyId === s.id}
                onRollback={() => void rollback(s.id)}
                onSaveMeta={(label, notes) => void saveMeta(s.id, label, notes)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SnapshotRow({
  row,
  isDraft,
  isPublished,
  busy,
  onRollback,
  onSaveMeta,
}: {
  row: SnapRow;
  isDraft: boolean;
  isPublished: boolean;
  busy: boolean;
  onRollback: () => void;
  onSaveMeta: (label: string, notes: string) => void;
}) {
  const [label, setLabel] = useState(row.label ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");

  useEffect(() => {
    setLabel(row.label ?? "");
    setNotes(row.notes ?? "");
  }, [row.label, row.notes]);

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="px-3 py-2 align-top font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {row.created_at.slice(0, 19).replace("T", " ")}
        <div className="mt-1 break-all text-[10px] text-zinc-400">{row.id}</div>
        {isDraft && <span className="mt-1 inline-block rounded bg-blue-100 px-1 text-[10px] text-blue-900">concept</span>}
        {isPublished && (
          <span className="mt-1 ml-1 inline-block rounded bg-emerald-100 px-1 text-[10px] text-emerald-900">live</span>
        )}
      </td>
      <td className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300">{row.source}</td>
      <td className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300">{row.created_by ?? "—"}</td>
      <td className="px-3 py-2 align-top">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="mb-1 w-full rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notities"
          rows={2}
          className="w-full rounded border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onSaveMeta(label, notes)}
          className={cn(
            "mt-1 text-xs font-medium text-blue-800 underline disabled:opacity-50 dark:text-blue-400",
          )}
        >
          Meta opslaan
        </button>
      </td>
      <td className="px-3 py-2 align-top">
        <button
          type="button"
          disabled={busy}
          onClick={onRollback}
          className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-900"
        >
          {busy ? "…" : "Concept = deze"}
        </button>
      </td>
    </tr>
  );
}
