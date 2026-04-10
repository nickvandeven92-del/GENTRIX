"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Film, ImagePlus, Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import type { TailwindPageConfig, TailwindSection } from "@/lib/ai/tailwind-sections-schema";
import type { SiteChatTurn } from "@/lib/ai/site-chat-with-claude";
import { STUDIO_DEFAULT_SILENT_HERO_MP4_URLS } from "@/lib/site/studio-default-hero-videos";
import { cn } from "@/lib/utils";

type ChatRow = { id: string; role: "user" | "assistant"; content: string };

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
  disabled,
  className,
  onApplyAi,
}: SiteAiChatPanelProps) {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedHeroUrlIndex, setCopiedHeroUrlIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
  }, [rows, loading]);

  const uploadFile = useCallback(
    async (file: File) => {
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
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [subfolderSlug],
  );

  function clearConversation() {
    setRows([]);
    setAttachmentUrls([]);
    setError(null);
    setInput("");
    inputRef.current?.focus();
  }

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
    setError(null);

    try {
      const res = await fetch("/api/ai-site-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sections,
          config: config ?? null,
          attachmentUrls,
        }),
      });
      const payload = (await res.json()) as
        | {
            ok: true;
            data: {
              reply: string;
              sections?: TailwindSection[];
              config: TailwindPageConfig | null;
            };
          }
        | { ok: false; error: string };

      if (!res.ok || !payload.ok) {
        setError(!payload.ok ? payload.error : "Chat mislukt.");
        return;
      }

      setRows((r) => [
        ...r,
        { id: crypto.randomUUID(), role: "assistant", content: payload.data.reply },
      ]);

      if (payload.data.sections?.length) {
        onApplyAi({
          sections: payload.data.sections,
          config: payload.data.config ?? undefined,
          label: text.slice(0, 100),
        });
      }
    } catch {
      setError("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-violet-200 bg-violet-50/80 dark:border-violet-900/50 dark:bg-violet-950/30",
        className,
      )}
      aria-label="Site-assistent"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-200/80 px-4 py-3 dark:border-violet-800/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-5 shrink-0 text-violet-700 dark:text-violet-400" aria-hidden />
            <h2 className="text-sm font-semibold text-violet-950 dark:text-violet-100">Site-assistent</h2>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-violet-800/90 dark:text-violet-300/90">
            Praat met Claude over feedback en aanpassingen — antwoord eerst, daarna wijzigingen waar nodig. Gebruik{" "}
            <strong>Ongedaan</strong> / <strong>Stappen</strong> bovenaan om terug te gaan.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif,video/mp4,video/webm"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
            }}
          />
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-700 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950"
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <ImagePlus className="size-3.5" aria-hidden />}
            Logo / media
          </button>
          <button
            type="button"
            disabled={loading || (rows.length === 0 && attachmentUrls.length === 0)}
            onClick={clearConversation}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/80 bg-white/90 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40 dark:border-violet-800 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950"
            title="Wis berichten en bijlagen (concept blijft staan)"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Wis chat
          </button>
        </div>
      </div>

      <details className="mx-4 mt-2 text-xs text-violet-900/90 dark:text-violet-200/85">
        <summary className="cursor-pointer select-none font-medium text-violet-800 hover:text-violet-950 dark:text-violet-300 dark:hover:text-violet-100">
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
            Eigen logo of MP4/WebM: upload via <strong>Logo / media</strong>, daarna in de chat verwijzen naar die URL.
          </p>
        </div>
      </details>

      <details className="mx-4 mt-1 text-xs text-violet-900/90 dark:text-violet-200/85">
        <summary className="cursor-pointer select-none font-medium text-violet-800 hover:text-violet-950 dark:text-violet-300 dark:hover:text-violet-100">
          Standaard video-links (alleen nodig om handmatig te plakken)
        </summary>
        <ul className="mt-2 space-y-2 border-t border-violet-200/70 pt-2 dark:border-violet-800/50">
          {STUDIO_DEFAULT_SILENT_HERO_MP4_URLS.map((url, i) => (
            <li key={url} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="min-w-0 break-all font-mono text-[10px] text-zinc-600 dark:text-zinc-400">{url}</span>
              <button
                type="button"
                onClick={() => void copyHeroStockUrl(url, i)}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-300 bg-white px-2 py-1 text-[10px] font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:bg-zinc-900 dark:text-violet-100 dark:hover:bg-violet-950"
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
              className="flex items-center gap-1 rounded-full border border-violet-200 bg-white pl-2 text-xs dark:border-violet-800 dark:bg-zinc-900"
            >
              {/\.(mp4|webm)(\?|$)/i.test(url) ? (
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded bg-violet-200 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"
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
        className="mx-4 mt-3 flex min-h-[200px] flex-1 flex-col space-y-3 overflow-y-auto rounded-lg border border-violet-100 bg-white/90 p-3 dark:border-violet-900/40 dark:bg-zinc-950/80 lg:min-h-[280px] lg:max-h-[min(52vh,560px)]"
      >
        {rows.length === 0 && !loading && (
          <div className="flex flex-1 flex-col justify-center gap-3 py-2">
            <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
              Stel een vraag, vraag om feedback, of tik op een voorstel om te beginnen.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
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
                  className="rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2 text-left text-xs font-medium leading-snug text-violet-950 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/50"
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
                ? "ml-6 bg-violet-100 text-violet-950 dark:bg-violet-900/40 dark:text-violet-50"
                : "mr-6 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100",
            )}
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {r.role === "user" ? "Jij" : "Claude"}
            </span>
            <div className="whitespace-pre-wrap break-words leading-relaxed">{r.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-violet-800 dark:text-violet-200">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Claude denkt na…
          </div>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto flex gap-2 p-4 pt-2">
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
          rows={3}
          disabled={loading || disabled}
          placeholder="Bijv.: Wat vind je van de hiërarchie boven de vouw? / Maak de FAQ compacter. (Shift+Enter voor nieuwe regel)"
          className={cn(
            "min-h-[44px] flex-1 resize-y rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm",
            "focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400/30",
            "disabled:opacity-60 dark:border-violet-800 dark:bg-zinc-950 dark:text-zinc-100",
          )}
        />
        <button
          type="button"
          disabled={loading || disabled || sections.length === 0}
          onClick={() => void send()}
          className="inline-flex shrink-0 items-center gap-2 self-end rounded-lg bg-violet-800 px-4 py-2 text-sm font-medium text-white hover:bg-violet-900 disabled:opacity-50 dark:bg-violet-700 dark:hover:bg-violet-600"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Verstuur
        </button>
      </div>
    </section>
  );
}
