"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientSupportThreadRow } from "@/lib/data/list-client-support-threads";
import type { ClientSupportMessageRow } from "@/lib/data/list-client-support-messages";
import { cn } from "@/lib/utils";

type Thread = ClientSupportThreadRow;
type Message = ClientSupportMessageRow;

type Props = {
  slug: string;
  initialOpen: Thread[];
  initialClosed: Thread[];
};

export function PortalSupportChat({ slug, initialOpen, initialClosed }: Props) {
  const router = useRouter();
  const decoded = useMemo(() => decodeURIComponent(slug), [slug]);
  const enc = useMemo(() => encodeURIComponent(decoded), [decoded]);
  const apiBase = `/api/portal/clients/${enc}/support`;

  const [tab, setTab] = useState<"open" | "archive">("open");
  const [openThreads, setOpenThreads] = useState<Thread[]>(initialOpen);
  const [closedThreads, setClosedThreads] = useState<Thread[]>(initialClosed);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [threadStatus, setThreadStatus] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threads = tab === "open" ? openThreads : closedThreads;

  const refreshLists = useCallback(async () => {
    const [o, c] = await Promise.all([
      fetch(`${apiBase}/threads?scope=open`, { credentials: "include" }).then((r) => r.json()),
      fetch(`${apiBase}/threads?scope=closed`, { credentials: "include" }).then((r) => r.json()),
    ]);
    if (o?.ok && Array.isArray(o.threads)) setOpenThreads(o.threads);
    if (c?.ok && Array.isArray(c.threads)) setClosedThreads(c.threads);
  }, [apiBase]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadStatus(null);
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/threads/${encodeURIComponent(selectedId)}/messages`, {
          credentials: "include",
        });
        const j = (await res.json()) as {
          ok?: boolean;
          messages?: Message[];
          threadStatus?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !j?.ok) {
          setError(j?.error ?? `HTTP ${res.status}`);
          setMessages([]);
          return;
        }
        setMessages(j.messages ?? []);
        setThreadStatus(j.threadStatus ?? null);
        void refreshLists();
      } catch {
        if (!cancelled) setError("Netwerkfout.");
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, selectedId, refreshLists]);

  const createThread = useCallback(async () => {
    const body = newBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          body,
          subject: newSubject.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; thread?: Thread; error?: string };
      if (!res.ok || !j?.ok || !j.thread) {
        setError(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      setNewBody("");
      setNewSubject("");
      setTab("open");
      setOpenThreads((prev) => [{ ...j.thread!, unread_staff_count: 0 }, ...prev]);
      setSelectedId(j.thread.id);
      router.refresh();
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusy(false);
    }
  }, [apiBase, busy, newBody, newSubject, router]);

  const sendReply = useCallback(async () => {
    const body = replyBody.trim();
    if (!body || !selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/threads/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      const j = (await res.json()) as { ok?: boolean; message?: Message; error?: string };
      if (!res.ok || !j?.ok || !j.message) {
        setError(j?.error ?? `HTTP ${res.status}`);
        return;
      }
      setReplyBody("");
      setMessages((prev) => [...prev, j.message!]);
      void refreshLists();
      router.refresh();
    } catch {
      setError("Netwerkfout.");
    } finally {
      setBusy(false);
    }
  }, [apiBase, busy, replyBody, selectedId, refreshLists, router]);

  const inputCls = cn(
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900",
    "placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400/30",
    "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500",
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Nieuw onderwerp</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Je vraag wordt automatisch bij je dossier geregistreerd. We antwoorden zo snel mogelijk; je ziet bij elk studio-antwoord van wie het komt.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" htmlFor="support-subject">
              Onderwerp (optioneel)
            </label>
            <input
              id="support-subject"
              type="text"
              maxLength={200}
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Bijv. Factuur april"
              className={cn("mt-1", inputCls)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" htmlFor="support-body">
              Je vraag
            </label>
            <textarea
              id="support-body"
              rows={4}
              maxLength={8000}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Beschrijf je vraag…"
              className={cn("mt-1 resize-y", inputCls)}
            />
          </div>
          <button
            type="button"
            onClick={() => void createThread()}
            disabled={busy || !newBody.trim()}
            className={cn(
              "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800",
              "disabled:pointer-events-none disabled:opacity-50",
              "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
            )}
          >
            {busy ? "Verzenden…" : "Vraag versturen"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Je gesprekken</h2>
          <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => {
                setTab("open");
                setSelectedId(null);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                tab === "open"
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/80",
              )}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("archive");
                setSelectedId(null);
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium",
                tab === "archive"
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/80",
              )}
            >
              Archief
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="min-h-[200px] rounded-lg border border-zinc-100 dark:border-zinc-800">
            {threads.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
                {tab === "open" ? "Geen open gesprekken." : "Geen gearchiveerde gesprekken."}
              </p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left text-sm transition-colors",
                        selectedId === t.id
                          ? "bg-zinc-100 dark:bg-zinc-800/80"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {(t.unread_staff_count ?? 0) > 0 ? (
                          <span
                            className="mt-2 size-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500"
                            title="Nieuw studio-antwoord"
                            aria-hidden
                          />
                        ) : null}
                        <span className="min-w-0 flex-1 font-medium text-zinc-900 dark:text-zinc-50">{t.subject}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                        {t.status === "closed" ? "Gesloten · " : ""}
                        {new Date(t.updated_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-h-[280px] rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            {!selectedId ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Kies een gesprek om berichten te zien.</p>
            ) : loadingMsgs ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Laden…</p>
            ) : (
              <>
                <ul className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm",
                        m.author_kind === "staff"
                          ? "ml-0 border-blue-200 bg-white text-zinc-800 dark:border-blue-900/50 dark:bg-zinc-950 dark:text-zinc-200"
                          : "mr-8 border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200",
                      )}
                    >
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {m.author_kind === "staff"
                          ? `Studio — ${m.staff_display_name ?? "Medewerker"}`
                          : "Jij"}
                        <span className="mx-1.5 font-normal">·</span>
                        {new Date(m.created_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{m.body}</p>
                    </li>
                  ))}
                </ul>
                {threadStatus === "open" ? (
                  <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <label className="sr-only" htmlFor="support-reply">
                      Antwoord
                    </label>
                    <textarea
                      id="support-reply"
                      rows={3}
                      maxLength={8000}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Typ een vervolgbericht…"
                      className={cn("resize-y", inputCls)}
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={busy || !replyBody.trim()}
                      className={cn(
                        "mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800",
                        "disabled:pointer-events-none disabled:opacity-50",
                        "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
                      )}
                    >
                      {busy ? "Verzenden…" : "Versturen"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Dit onderwerp is gesloten.</p>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
