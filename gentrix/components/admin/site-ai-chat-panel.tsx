"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Copy, Film, Loader2, MessageCircle, X } from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { SiteChatStreamNdjsonEvent, SiteChatTurn } from "@/lib/ai/site-chat-with-claude";
import { consumeSiteChatNdjsonBuffer } from "@/lib/api/site-chat-stream-events";
import { STUDIO_DEFAULT_SILENT_HERO_MP4_URLS } from "@/lib/site/studio-default-hero-videos";
import { cn } from "@/lib/utils";

type ChatRow = { id: string; role: "user" | "assistant"; content: string };

const ACCEPT_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

function fileIsAccepted(file: File): boolean {
  if (file.type && ACCEPT_MIME.has(file.type)) return true;
  return /\.(png|jpe?g|webp|svg|gif|mp4|webm)$/i.test(file.name);
}

/** Korte startsuggesties (zelfde intent als de oude snelle commando’s, nu via gesprek). */
const CHAT_STARTER_PROMPTS = [
  "Maak de hero luxer en high-end; behoud merk, ankers en toegankelijkheid.",
  "Maak de layout rustiger op mobiel: minder druk, betere witruimte en leesbaarheid.",
  "Scherp de primaire call-to-action aan (tekst, contrast, hiërarchie) zonder spammy taal.",
] as const;

type SiteAiChatPanelProps = {
  subfolderSlug: string;
  sections: TailwindSection[];
  config: TailwindPageConfig | null | undefined;
  /** Zelfde als klantdossier; stuurt mee naar API voor prompt-context. */
  appointmentsEnabled?: boolean;
  webshopEnabled?: boolean;
  disabled?: boolean;
  className?: string;
  onApplyAi: (next: {
    sections: TailwindSection[];
    config: TailwindPageConfig | null | undefined;
    label: string;
  }) => void;
};

export function SiteAiChatPanel({
  subfolderSlug,
  sections,
  config,
  appointmentsEnabled = true,
  webshopEnabled = true,
  disabled,
  className,
  onApplyAi,
}: SiteAiChatPanelProps) {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Tussentijdse statusregels van de server (NDJSON `status`). */
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  /** Tekst uit het inkomende JSON-antwoord (`reply_preview`), voor een lopend gesprek. */
  const [streamingReply, setStreamingReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedHeroUrlIndex, setCopiedHeroUrlIndex] = useState<number | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const copyHeroStockUrl = useCallback(async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedHeroUrlIndex(index);
      window.setTimeout(() => {
        setCopiedHeroUrlIndex((cur) => (cur === index ? null : cur));
      }, 2000);
    } catch {
      setError("Kopiëren mislukt in deze browser.");
    }
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [rows, loading, streamingReply, streamingStatus]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!fileIsAccepted(file)) {
        setError("Alleen afbeelding (PNG, JPG, WebP, SVG, GIF) of video (MP4, WebM).");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        fd.set("subfolder_slug", subfolderSlug);
        const res = await fetch("/api/upload/site-asset", { method: "POST", body: fd });
        const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok || !json.ok || !json.url) {
          setError(json.error ?? "Upload mislukt.");
          return;
        }
        setAttachmentUrls((u) => [...u, json.url!]);
      } catch {
        setError("Netwerkfout bij upload.");
      } finally {
        setUploading(false);
      }
    },
    [subfolderSlug],
  );

  const onDropFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const ok = list.filter(fileIsAccepted);
      if (ok.length === 0 && list.length > 0) {
        setError("Alleen afbeelding (PNG, JPG, WebP, SVG, GIF) of video (MP4, WebM).");
        return;
      }
      if (ok.length === 0) return;
      void (async () => {
        for (const f of ok) {
          await uploadFile(f);
        }
      })();
    },
    [uploadFile],
  );

  async function send() {
    const text = input.trim();
    if (text.length < 1) {
      setError("Schrijf een bericht.");
      return;
    }
    const userRow: ChatRow = { id: crypto.randomUUID(), role: "user", content: text };
    const nextRows = [...rows, userRow];
    const apiMessages: SiteChatTurn[] = nextRows.map((r) => ({ role: r.role, content: r.content }));

    setRows(nextRows);
    setInput("");
    setLoading(true);
    setStreamingStatus("Verzoek wordt klaargezet…");
    setStreamingReply("");
    setError(null);

    let sawComplete = false;
    let sawError = false;

    try {
      const res = await fetch("/api/ai-site-chat/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        body: JSON.stringify({
          messages: apiMessages,
          sections,
          config: config ?? null,
          attachmentUrls,
          appointmentsEnabled,
          webshopEnabled,
        }),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("ndjson") && !ct.includes("x-ndjson")) {
        const payload = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || payload.ok === false) {
          setError(payload.error ?? "Chat mislukt.");
          return;
        }
        setError("Onverwacht antwoordformaat van de server.");
        return;
      }

      if (!res.body) {
        setError("Geen response-stream van de server.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleNdjsonEvent = (ev: SiteChatStreamNdjsonEvent) => {
        if (ev.type === "status") {
          setStreamingStatus(ev.message);
        }
        if (ev.type === "reply_preview") {
          setStreamingReply(ev.text);
        }
        if (ev.type === "complete") {
          sawComplete = true;
          setRows((r) => [
            ...r,
            { id: crypto.randomUUID(), role: "assistant", content: ev.data.reply },
          ]);
          if (ev.data.sections?.length) {
            onApplyAi({
              sections: ev.data.sections,
              config: ev.data.config ?? undefined,
              label: text.slice(0, 100),
            });
          }
        }
        if (ev.type === "error") {
          sawError = true;
          setError(ev.message);
        }
      };

      while (!sawComplete && !sawError) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = consumeSiteChatNdjsonBuffer(buffer, decoder.decode(value, { stream: true }), handleNdjsonEvent);
      }
      if (buffer.trim()) {
        buffer = consumeSiteChatNdjsonBuffer(buffer, "\n", handleNdjsonEvent);
      }

      await reader.cancel().catch(() => {});

      if (!sawComplete && !sawError) {
        setError((prev) => prev ?? "Het antwoord werd niet afgerond (verbinding of time-out). Probeer opnieuw.");
      }
    } catch {
      setError("Netwerkfout.");
    } finally {
      setLoading(false);
      setStreamingStatus(null);
      setStreamingReply("");
    }
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-zinc-200/90 bg-zinc-50/90 dark:border-zinc-700/80 dark:bg-zinc-900/50",
        className,
      )}
      aria-label="Site-assistent"
    >
      <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700/60">
        <div className="flex items-start gap-2">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-zinc-600 dark:text-zinc-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Site-assistent</h2>
            <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
              Praat met Claude over feedback en aanpassingen. Sleep logo of video naar het invoerveld om te uploaden.{" "}
              <strong>Ongedaan</strong> / <strong>Stappen</strong> bovenaan om terug te gaan.
            </p>
          </div>
        </div>
      </div>

      <details className="mx-4 mt-2 text-xs text-zinc-700 dark:text-zinc-300">
        <summary className="cursor-pointer select-none font-medium text-zinc-800 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100">
          Tips: hero-video, logo en technische grenzen
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-3 py-2.5 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Stille achtergrondvideo</p>
          <p className="text-emerald-900/95 dark:text-emerald-100/95">
            Vraag om een <strong>stille achtergrondvideo</strong> of <strong>bewegende hero</strong> — Claude kan een stock-loop in een echt{" "}
            <code className="rounded bg-emerald-200/60 px-1 dark:bg-emerald-900/60">&lt;video&gt;</code> zetten.
          </p>
          <p className="rounded bg-white/70 px-2 py-1.5 font-mono text-[11px] text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
            Voorbeeld: “Zet in de hero een stille achtergrondvideo met donkere overlay zodat de kop leesbaar blijft.”
          </p>
          <p className="text-emerald-900/90 dark:text-emerald-100/90">
            Eigen logo of MP4/WebM: <strong>sleep het bestand naar het tekstvak</strong> hieronder; daarna in de chat naar die URL verwijzen.
          </p>
        </div>
      </details>

      <details className="mx-4 mt-1 text-xs text-zinc-700 dark:text-zinc-300">
        <summary className="cursor-pointer select-none font-medium text-zinc-800 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100">
          Standaard video-links (alleen nodig om handmatig te plakken)
        </summary>
        <ul className="mt-2 space-y-2 border-t border-zinc-200/70 pt-2 dark:border-zinc-700/50">
          {STUDIO_DEFAULT_SILENT_HERO_MP4_URLS.map((url, i) => (
            <li key={url} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="min-w-0 break-all font-mono text-[10px] text-zinc-600 dark:text-zinc-400">{url}</span>
              <button
                type="button"
                onClick={() => void copyHeroStockUrl(url, i)}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-[10px] font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <Copy className="size-3" aria-hidden />
                {copiedHeroUrlIndex === i ? "Gekopieerd" : "Kopieer"}
              </button>
            </li>
          ))}
        </ul>
      </details>

      {attachmentUrls.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 px-4">
          {attachmentUrls.map((url) => (
            <li
              key={url}
              className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white pl-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {/\.(mp4|webm)(\?|$)/i.test(url) ? (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  aria-hidden
                >
                  <Film className="size-3.5" />
                </span>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={url} alt="" className="size-6 rounded object-cover" />
              )}
              <span className="max-w-[140px] truncate font-mono text-[10px] text-zinc-600 dark:text-zinc-400">{url}</span>
              <button
                type="button"
                aria-label="Verwijder bijlage"
                className="p-1 text-zinc-500 hover:text-red-600"
                onClick={() => setAttachmentUrls((u) => u.filter((x) => x !== url))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={listRef}
        className="mx-4 mt-3 flex min-h-[min(160px,28dvh)] flex-1 flex-col space-y-3 overflow-y-auto rounded-lg border border-zinc-200/80 bg-white p-3 dark:border-zinc-700/60 dark:bg-zinc-950/80"
      >
        {rows.length === 0 && !loading && !streamingReply && (
          <div className="flex flex-1 flex-col justify-center gap-3 py-2">
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Stel een vraag of kies een voorstel.
            </p>
            <div className="flex flex-col gap-2">
              {CHAT_STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setInput(prompt);
                    setError(null);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium leading-snug text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              r.role === "user"
                ? "ml-4 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                : "mr-4 bg-zinc-50 text-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100",
            )}
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {r.role === "user" ? "Jij" : "Claude"}
            </span>
            <div className="whitespace-pre-wrap break-words leading-relaxed">{r.content}</div>
          </div>
        ))}
        {loading && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              "mr-4 border border-zinc-200/90 bg-white text-zinc-800 shadow-sm dark:border-zinc-600/80 dark:bg-zinc-900/90 dark:text-zinc-100",
            )}
            aria-live="polite"
            aria-busy="true"
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Claude
            </span>
            {streamingReply.trim().length > 0 ? (
              <div className="space-y-2">
                <div className="whitespace-pre-wrap break-words leading-relaxed">{streamingReply}</div>
                {streamingStatus ? (
                  <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{streamingStatus}</p>
                ) : null}
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex size-1.5 animate-pulse rounded-full bg-indigo-500" aria-hidden />
                  Bezig…
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-zinc-500" aria-hidden />
                <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {streamingStatus ??
                    "Even geduld — we sturen je site naar Claude; het antwoord verschijnt hier zodra de eerste woorden binnen zijn."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto p-3 pt-2">
        <div
          ref={composerRef}
          className={cn(
            "relative rounded-2xl border bg-white transition-shadow dark:bg-zinc-950",
            fileDragOver
              ? "border-blue-500 ring-2 ring-blue-500/25 dark:border-blue-500"
              : "border-zinc-200 dark:border-zinc-700",
            uploading && "opacity-80",
          )}
          onDragEnter={(e) => {
            if ([...e.dataTransfer.types].includes("Files")) {
              e.preventDefault();
              setFileDragOver(true);
            }
          }}
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes("Files")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setFileDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (composerRef.current && !composerRef.current.contains(e.relatedTarget as Node)) {
              setFileDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setFileDragOver(false);
            if (disabled) return;
            const { files } = e.dataTransfer;
            if (files?.length) onDropFiles(files);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && !disabled) void send();
              }
            }}
            rows={2}
            disabled={loading || disabled || uploading}
            placeholder="Vraag of instructie… (sleep bestanden hierheen)"
            className={cn(
              "max-h-[min(200px,40dvh)] min-h-[44px] w-full resize-none rounded-2xl border-0 bg-transparent px-3 pb-11 pt-2.5 text-sm leading-relaxed",
              "text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0",
              "disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500",
            )}
          />
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-2">
            {uploading ? (
              <span className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900">
                <Loader2 className="size-4 animate-spin text-zinc-600 dark:text-zinc-300" aria-hidden />
              </span>
            ) : null}
            <button
              type="button"
              disabled={loading || disabled || sections.length === 0 || uploading}
              onClick={() => void send()}
              className={cn(
                "pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                "border-zinc-200 bg-zinc-900 text-white hover:bg-zinc-800",
                "disabled:pointer-events-none disabled:opacity-35",
                "dark:border-zinc-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white",
              )}
              title="Verstuur"
              aria-label="Verstuur bericht"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUp className="size-4" aria-hidden strokeWidth={2.25} />
              )}
            </button>
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-zinc-500 dark:text-zinc-500">Shift+Enter voor nieuwe regel</p>
      </div>
    </section>
  );
}
