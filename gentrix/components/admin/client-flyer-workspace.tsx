"use client";

import type { FlyerScanSummary } from "@/lib/data/get-flyer-scan-summary";
import { FlyerStudioEditor } from "@/components/admin/flyer-studio-editor";
import type { FlyerStudioPersisted } from "@/lib/flyer/flyer-studio-schema";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, ExternalLink, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  clientName: string;
  flyerQrAbsoluteUrl: string | null;
  flyerScanSummary: FlyerScanSummary | null;
  initialFlyerStudio: FlyerStudioPersisted;
};

export function ClientFlyerWorkspace({
  slug,
  clientName,
  flyerQrAbsoluteUrl,
  flyerScanSummary,
  initialFlyerStudio,
}: Props) {
  const enc = encodeURIComponent(slug);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const previewSrc = flyerQrAbsoluteUrl ? qrDataUrl : null;

  useEffect(() => {
    if (!flyerQrAbsoluteUrl) return;
    let cancelled = false;
    void QRCode.toDataURL(flyerQrAbsoluteUrl, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#18181b", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [flyerQrAbsoluteUrl]);

  const copyLink = useCallback(async () => {
    if (!flyerQrAbsoluteUrl) return;
    try {
      await navigator.clipboard.writeText(flyerQrAbsoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [flyerQrAbsoluteUrl]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Flyer & QR</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Vaste korte link per klant — wijst naar live site of conceptpreview. Gebruik op drukwerk; scans verschijnen
          hieronder zodra de tabel <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">flyer_scans</code>{" "}
          actief is. Teksten voor de PDF bewaar je in de Flyerstudio (kolom{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">flyer_studio_json</code>).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">
              <QrCode className="size-3.5" aria-hidden />
              Flyer-link
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{clientName}</span>
          </div>

          {flyerQrAbsoluteUrl ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <code className="break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {flyerQrAbsoluteUrl}
                </code>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  >
                    {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    {copied ? "Gekopieerd" : "Kopiëren"}
                  </button>
                  <a
                    href={flyerQrAbsoluteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-950 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-950/70"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Testen
                  </a>
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Deze URL staat in de PDF. Wijzig je niet per generatie — zelfde QR op bestaande flyers blijft werken.
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Geen flyer-link beschikbaar. Controleer of de migratie voor <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">flyer_public_token</code> op
              Supabase staat.
            </p>
          )}
        </div>

        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 dark:border-zinc-700 dark:bg-zinc-900/40",
            !flyerQrAbsoluteUrl && "opacity-60",
          )}
        >
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">QR-preview</p>
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt="" width={220} height={220} className="rounded-lg bg-white p-2 shadow-md" />
          ) : (
            <div className="flex size-[220px] items-center justify-center rounded-lg bg-zinc-200/80 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {flyerQrAbsoluteUrl ? "…" : "—"}
            </div>
          )}
        </div>
      </div>

      <FlyerStudioEditor slug={slug} initialStudio={initialFlyerStudio} />

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">A4-flyer (PDF)</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Drie stijlen; zelfde QR. Sla je copy eerst op in de Flyerstudio — daarna bevat elke PDF die teksten (lege velden
          vullen we per stijl met een standaard).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <a
            href={`/api/clients/${enc}/flyer-pdf?template=gentrix`}
            className="group flex flex-col rounded-2xl border border-violet-400/50 bg-gradient-to-b from-violet-950 to-zinc-950 p-5 text-zinc-50 shadow-sm transition hover:border-violet-400 hover:shadow-md"
          >
            <span className="text-sm font-semibold">Gentrix · merk</span>
            <span className="mt-1 text-xs text-violet-100/85">Donker gradient, logo, paarse accenten.</span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-200 group-hover:text-white">
              <Download className="size-4" aria-hidden />
              Download PDF
            </span>
          </a>
          <a
            href={`/api/clients/${enc}/flyer-pdf?template=minimal`}
            className="group flex flex-col rounded-2xl border border-zinc-200 bg-gradient-to-b from-white to-zinc-50/80 p-5 transition hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900/80 dark:hover:border-violet-800"
          >
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Rustig · licht</span>
            <span className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Zwart op licht, strak voor drukwerk.</span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-700 group-hover:text-violet-800 dark:text-violet-300">
              <Download className="size-4" aria-hidden />
              Download PDF
            </span>
          </a>
          <a
            href={`/api/clients/${enc}/flyer-pdf?template=modern`}
            className="group flex flex-col rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 text-zinc-50 transition hover:border-violet-500/50 hover:shadow-lg sm:col-span-1"
          >
            <span className="text-sm font-semibold">Modern · donker</span>
            <span className="mt-1 text-xs text-zinc-400">Donker vlak, witte QR-omlijning.</span>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-violet-300 group-hover:text-violet-200">
              <Download className="size-4" aria-hidden />
              Download PDF
            </span>
          </a>
        </div>
      </div>

      {flyerScanSummary ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Scanstatistieken</p>
          {flyerScanSummary.total === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Nog geen scans op de flyer-link.</p>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">{flyerScanSummary.total}</span>{" "}
                {flyerScanSummary.total === 1 ? "scan" : "scans"} totaal
                {flyerScanSummary.last7Days > 0 ? (
                  <>
                    {" "}
                    · <span className="font-medium">{flyerScanSummary.last7Days}</span> in de laatste 7 dagen
                  </>
                ) : null}
              </p>
              {flyerScanSummary.lastScannedAt ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Laatste:{" "}
                  {new Intl.DateTimeFormat("nl-NL", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(flyerScanSummary.lastScannedAt))}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Terug naar{" "}
        <Link href={`/admin/clients/${enc}`} className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
          dossier-overzicht
        </Link>
        .
      </p>
    </div>
  );
}
