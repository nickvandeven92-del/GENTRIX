"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Film, Loader2, MessageCircle, X } from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { SiteChatStreamNdjsonEvent, SiteChatTurn } from "@/lib/ai/site-chat-with-claude";
import { consumeSiteChatNdjsonBuffer } from "@/lib/api/site-chat-stream-events";
import { cn } from "@/lib/utils";

type ChatRow = { id: string; role: "user" | "assistant"; content: string };

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  );
}

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
  /** Klant-/sitenaam voor server-side AI-hero (Gemini/OpenAI) na chat. */
  businessName: string;
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
  businessName,
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
  const [fileDragOver, setFileDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  /** Annuleer lopende POST naar `/api/ai-site-chat/stream` (body stream stopt mee). */
  const chatAbortRef = useRef<AbortController | null>(null);

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

  const handleComposerPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled || loading || uploading) return;
      const items = e.clipboardData?.items;
      if (!items?.length) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it?.kind === "file") {
          const f = it.getAsFile();
          if (f && fileIsAccepted(f)) files.push(f);
        }
      }
      if (files.length === 0) return;
      e.preventDefault();
      onDropFiles(files);
    },
    [disabled, loading, uploading, onDropFiles],
  );

  async function send() {
    const text = input.trim();
    if (text.length < 1) {
      setError("Schrijf een bericht.");
      return;
    }
    const attachmentUrlsThisTurn = [...attachmentUrls];
    const userRow: ChatRow = { id: crypto.randomUUID(), role: "user", content: text };
    const nextRows = [...rows, userRow];
    const apiMessages: SiteChatTurn[] = nextRows.map((r) => ({ role: r.role, content: r.content }));

    setRows(nextRows);
    setInput("");
    setAttachmentUrls([]);
    setLoading(true);
    setStreamingStatus("Verzoek wordt klaargezet…");
    setStreamingReply("");
    setError(null);

    let sawComplete = false;
    let sawError = false;
    let userAborted = false;

    const ac = new AbortController();
    chatAbortRef.current = ac;

    try {
      const res = await fetch("/api/ai-site-chat/stream", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
        signal: ac.signal,
        body: JSON.stringify({
          messages: apiMessages,
          sections,
          config: config ?? null,
          attachmentUrls: attachmentUrlsThisTurn,
          appointmentsEnabled,
          webshopEnabled,
          businessName: businessName.trim() || undefined,
          subfolder_slug: subfolderSlug,
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

      try {
        while (!sawComplete && !sawError) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = consumeSiteChatNdjsonBuffer(buffer, decoder.decode(value, { stream: true }), handleNdjsonEvent);
        }
      } catch (readErr) {
        if (ac.signal.aborted || isAbortError(readErr)) {
          userAborted = true;
        } else {
          throw readErr;
        }
      }

      if (buffer.trim()) {
        buffer = consumeSiteChatNdjsonBuffer(buffer, "\n", handleNdjsonEvent);
      }

      await reader.cancel().catch(() => {});

      if (!sawComplete && !sawError && !userAborted) {
        setError((prev) => prev ?? "Het antwoord werd niet afgerond (verbinding of time-out). Probeer opnieuw.");
      }
    } catch (e) {
      if (isAbortError(e) || ac.signal.aborted) {
        userAborted = true;
      } else {
        setError("Netwerkfout.");
      }
    } finally {
      chatAbortRef.current = null;
      setLoading(false);
      setStreamingStatus(null);
      setStreamingReply("");
    }
  }

  function cancelGeneration() {
    chatAbortRef.current?.abort();
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
              Praat met Claude over feedback en aanpassingen. Sleep bestanden naar het invoerveld of{" "}
              <strong>plak</strong> een screenshot / logo / video (Ctrl+V). <strong>Ongedaan</strong> /{" "}
              <strong>Stappen</strong> bovenaan om terug te gaan.
            </p>
          </div>
        </div>
      </div>

      <details className="mx-4 mt-2 text-xs text-zinc-700 dark:text-zinc-300">
        <summary className="cursor-pointer select-none font-medium text-zinc-800 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-100">
          Tips: hero, logo en technische grenzen
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-3 py-2.5 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-50">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Video in de hero</p>
          <p className="text-emerald-900/95 dark:text-emerald-100/95">
            Een echte <code className="rounded bg-emerald-200/60 px-1 dark:bg-emerald-900/60">&lt;video&gt;</code>-achtergrond alleen met een{" "}
            <strong>concrete https-MP4/WebM-URL</strong> in je bericht (of upload hieronder en verwijs naar de URL). Zonder link: vraag om dynamiek
            met foto, gradient of scroll/hover-animaties — de generator gebruikt geen vaste stock-video’s meer.
          </p>
          <p className="text-emerald-900/90 dark:text-emerald-100/90">
            Logo of video: <strong>sleep naar het tekstvak</strong> of <strong>plak vanaf het klembord</strong>; gebruik daarna
            die URL in je instructie.
          </p>
        </div>
      </details>

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
            <div className="select-text whitespace-pre-wrap break-words leading-relaxed">{r.content}</div>
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
                <div className="select-text whitespace-pre-wrap break-words leading-relaxed">{streamingReply}</div>
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

      <span id="site-ai-chat-composer-hint" className="sr-only">
        Plak gewone tekst of een toegestane afbeelding/video. Verstuur met Enter, of Ctrl+Enter / Cmd+Enter. Nieuwe regel:
        Shift+Enter.
      </span>
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
          <div className="flex gap-2 px-2 pt-2">
            {attachmentUrls.length > 0 ? (
              <div
                className="flex max-h-[min(120px,28dvh)] shrink-0 flex-col gap-1.5 overflow-y-auto pr-0.5"
                aria-label="Bijlagen bij dit bericht"
              >
                {attachmentUrls.map((url) => (
                  <div
                    key={url}
                    className="group relative size-11 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    {/\.(mp4|webm)(\?|$)/i.test(url) ? (
                      <span
                        className="flex size-full items-center justify-center text-zinc-600 dark:text-zinc-300"
                        aria-hidden
                      >
                        <Film className="size-5" />
                      </span>
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={url} alt="" className="size-full object-cover" />
                    )}
                    <button
                      type="button"
                      aria-label="Verwijder bijlage"
                      className="absolute -right-1 -top-1 rounded-full bg-zinc-900 p-0.5 text-white opacity-0 shadow hover:opacity-100 group-hover:opacity-100 dark:bg-zinc-100 dark:text-zinc-900"
                      onClick={() => setAttachmentUrls((u) => u.filter((x) => x !== url))}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              ref={inputRef}
              id="site-ai-chat-composer"
              aria-describedby="site-ai-chat-composer-hint"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handleComposerPaste}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (!loading && !disabled && !uploading) void send();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!loading && !disabled && !uploading) void send();
                }
              }}
              rows={2}
              disabled={loading || disabled || uploading}
              placeholder="Vraag of instructie… (sleep of plak bestanden)"
              className={cn(
                "max-h-[min(200px,40dvh)] min-h-[44px] min-w-0 flex-1 resize-none rounded-xl border-0 bg-transparent px-1 pb-11 pt-1 text-sm leading-relaxed",
                "text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0",
                "disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-500",
              )}
            />
          </div>
          <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-2">
            {uploading ? (
              <span className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900">
                <Loader2 className="size-4 animate-spin text-zinc-600 dark:text-zinc-300" aria-hidden />
              </span>
            ) : null}
            {loading ? (
              <button
                type="button"
                onClick={cancelGeneration}
                className={cn(
                  "pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                  "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100",
                  "dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
                )}
                title="Annuleer"
                aria-label="Annuleer generatie"
              >
                <span className="size-3 rounded-[2px] bg-current" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled || sections.length === 0 || uploading}
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
                <ArrowUp className="size-4" aria-hidden strokeWidth={2.25} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-zinc-500 dark:text-zinc-500">
          Enter verstuurt · Shift+Enter nieuwe regel · Ctrl+V / ⌘V ook voor plakken van afbeelding of video
        </p>
      </div>
    </section>
  );
}
