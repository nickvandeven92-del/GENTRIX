"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";

type PromoVideoDownloadButtonProps = {
  subfolderSlug: string;
  fileBase: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Klein label + geen uitleg eronder (bijv. Sites-tabel). */
  variant?: "default" | "compact";
  /** Extra classes op de download-knop (bijv. glass-thema hooks). */
  buttonClassName?: string;
  /** Voor glass-thema accenten (compact + sites-tabel). */
  buttonTone?: "pink" | "neutral";
};

function safeDownloadFilename(base: string): string {
  const s = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "site";
  return `${s}-promo-video.zip`;
}

type PickerTypes = { description: string; accept: Record<string, string[]> };

const ZIP_PICKER: PickerTypes = {
  description: "ZIP-archief",
  accept: { "application/zip": [".zip"] },
};

/** Chrome/Edge: kies zelf map + naam. Anders: klassieke download (vaak Downloads). */
async function saveBlobToDisk(
  blob: Blob,
  filename: string,
  picker: PickerTypes,
): Promise<"picker" | "download" | "cancelled"> {
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: {
            suggestedName?: string;
            types?: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;
        }
      ).showSaveFilePicker({
        suggestedName: filename,
        types: [picker],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picker";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2500);
  return "download";
}

export function PromoVideoDownloadButton({
  subfolderSlug,
  fileBase,
  disabled = false,
  disabledReason,
  variant = "default",
  buttonClassName,
  buttonTone,
}: PromoVideoDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    setHint(null);
    const path = `/api/admin/clients/${encodeURIComponent(subfolderSlug)}/promo-video`;
    const filename = safeDownloadFilename(fileBase);
    try {
      const res = await fetch(path, { method: "GET", credentials: "include" });
      const ct = (res.headers.get("content-type") ?? "").toLowerCase();

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `HTTP ${res.status}`);
      }

      if (ct.includes("application/json")) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Server gaf JSON i.p.v. ZIP.");
      }

      const blob = await res.blob();
      if (blob.size < 2_000) {
        const t = await blob.text().catch(() => "");
        throw new Error(
          t.slice(0, 200) || "ZIP te klein — opname mislukt. Controleer Playwright/Chromium en de terminal.",
        );
      }

      const how = await saveBlobToDisk(blob, filename, ZIP_PICKER);
      if (how === "picker") {
        setHint(
          `Opgeslagen: ${filename}. Pak uit: mobiel.webm (telefoon-weergave) en desktop.webm (breed scherm). WhatsApp: meestal mobiel.webm.`,
        );
      } else if (how === "download") {
        setHint(
          `ZIP: ${filename} — uitpakken voor mobiel.webm + desktop.webm. Check Downloads (Ctrl+J). Duurt bij eerste keer ~1–2 min.`,
        );
      } else {
        setHint("Opslaan geannuleerd.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const isDisabled = disabled || busy;
  const compact = variant === "compact";

  const defaultTitle =
    "ZIP met twee video’s: mobiel (390×844, trage vloeiende scroll) en desktop (1440×900). Duurt ~1–2 minuten. Playwright + Chromium vereist.";

  const title = disabled && disabledReason ? disabledReason : defaultTitle;

  return (
    <div className={cn("inline-flex flex-col gap-1", compact && "max-w-[15rem]")}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={title}
        data-tone={buttonTone}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg border border-pink-200 bg-pink-50 font-medium text-pink-950",
          "hover:bg-pink-100 disabled:pointer-events-none disabled:opacity-50",
          "dark:border-pink-900/50 dark:bg-pink-950/40 dark:text-pink-100 dark:hover:bg-pink-950/60",
          compact ? "px-2.5 py-1.5 text-xs" : "gap-2 px-4 py-2.5 text-sm",
          buttonClassName,
        )}
      >
        <Video className={cn("shrink-0", compact ? "size-3.5" : "size-4")} aria-hidden />
        {busy
          ? compact
            ? "…"
            : "Bezig (1–2 min)…"
          : compact
            ? "Video"
            : "WhatsApp preview-video"}
      </button>
      {hint ? (
        <p
          className={cn(
            "text-emerald-800 dark:text-emerald-300",
            compact ? "text-[10px] leading-tight" : "max-w-md text-xs",
          )}
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          className={cn(
            "text-red-600 dark:text-red-400",
            compact ? "max-w-[15rem] text-[10px] leading-tight" : "max-w-md text-xs",
          )}
        >
          {error}
        </p>
      ) : null}
      {!disabled && !compact ? (
        <p className="max-w-md text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          Je krijgt een <strong>ZIP</strong> met <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">mobiel.webm</code> en{" "}
          <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">desktop.webm</code> — langzaam gescrolld, minder haperingen.
          Eerst:{" "}
          <code className="rounded bg-zinc-200 px-0.5 dark:bg-zinc-800">npx playwright install chromium</code>.
        </p>
      ) : null}
    </div>
  );
}
