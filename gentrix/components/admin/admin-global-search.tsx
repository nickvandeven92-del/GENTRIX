"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { readResponseJson } from "@/lib/api/read-response-json";
import { cn } from "@/lib/utils";

type Hit = { id: string; name: string; subfolder_slug: string; status: string };

export function AdminGlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (query: string) => {
    const t = query.trim();
    if (t.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(t)}`, { credentials: "include" });
      const { data: json } = await readResponseJson<{ ok?: boolean; results?: Hit[] }>(res);
      if (json?.ok && Array.isArray(json.results)) setHits(json.results);
      else setHits([]);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 280);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (t.length < 2) return;
    setOpen(false);
    router.push(`/admin/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <form onSubmit={onSubmit} className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Zoek klant (naam of slug)…"
          autoComplete="off"
          className={cn(
            "w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-10 text-sm text-zinc-900",
            "placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            "dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50",
          )}
          aria-label="Zoek klanten"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-zinc-400" aria-hidden />
        )}
      </form>
      {open && q.trim().length >= 2 && (
        <div
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
          role="listbox"
        >
          {hits.length === 0 && !loading ? (
            <p className="px-3 py-2 text-sm text-zinc-500">Geen resultaten</p>
          ) : (
            hits.map((h) => (
              <Link
                key={h.id}
                href={`/admin/clients/${encodeURIComponent(h.subfolder_slug)}`}
                className="block px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                onClick={() => setOpen(false)}
              >
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{h.name}</span>
                <span className="ml-2 font-mono text-xs text-zinc-500">{h.subfolder_slug}</span>
                <span className="ml-2 text-xs text-zinc-400">· {h.status}</span>
              </Link>
            ))
          )}
          <Link
            href={`/admin/search?q=${encodeURIComponent(q.trim())}`}
            className="block border-t border-zinc-100 px-3 py-2 text-xs font-medium text-blue-800 dark:border-zinc-800 dark:text-blue-400"
            onClick={() => setOpen(false)}
          >
            Alle resultaten →
          </Link>
        </div>
      )}
    </div>
  );
}
