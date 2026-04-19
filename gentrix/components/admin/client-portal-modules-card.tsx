"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { STUDIO_WORKFLOW_PRESET_ADD_BOOKING } from "@/lib/admin/studio-workflow-presets";

type Props = {
  subfolderSlug: string;
  portal_invoices_enabled: boolean;
  portal_account_enabled: boolean;
  appointments_enabled: boolean;
  webshop_enabled: boolean;
  /** Absolute boek-URL op deze app (voor iframe / externe site). */
  bookingAbsoluteUrl: string;
  /** Absolute webshop-URL (`/winkel/{slug}`) voor iframe / externe site. */
  shopAbsoluteUrl: string;
};

type ModuleKey =
  | "portal_invoices_enabled"
  | "portal_account_enabled"
  | "appointments_enabled"
  | "webshop_enabled";

export function ClientPortalModulesCard({
  subfolderSlug,
  portal_invoices_enabled,
  portal_account_enabled,
  appointments_enabled,
  webshop_enabled,
  bookingAbsoluteUrl,
  shopAbsoluteUrl,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<ModuleKey | null>(null);
  const [bookingAppendBusy, setBookingAppendBusy] = useState<"add" | "replace" | null>(null);
  const [shopAppendBusy, setShopAppendBusy] = useState<"add" | "replace" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function patch(field: ModuleKey, value: boolean) {
    setBusy(field);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/commercial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Bijwerken mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setBusy(null);
    }
  }

  async function appendBookingSection(replaceExisting: boolean) {
    setBookingAppendBusy(replaceExisting ? "replace" : "add");
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/append-booking-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: replaceExisting }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Booking-sectie toevoegen mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setBookingAppendBusy(null);
    }
  }

  async function appendShopSection(replaceExisting: boolean) {
    setShopAppendBusy(replaceExisting ? "replace" : "add");
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/append-shop-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: replaceExisting }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Webshop-sectie toevoegen mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setShopAppendBusy(null);
    }
  }

  const encSlug = encodeURIComponent(subfolderSlug);
  const studioPresetHref = `/admin/ops/studio?slug=${encSlug}&preset=${STUDIO_WORKFLOW_PRESET_ADD_BOOKING}`;

  const rows: { field: ModuleKey; label: string; hint: string; checked: boolean }[] = [
    {
      field: "portal_invoices_enabled",
      label: "Facturen",
      hint: "Factuuroverzicht in het klantportaal.",
      checked: portal_invoices_enabled,
    },
    {
      field: "portal_account_enabled",
      label: "Account",
      hint: "Abonnement en opzeggen.",
      checked: portal_account_enabled,
    },
    {
      field: "appointments_enabled",
      label: "Afspraken",
      hint: "Aan: portaal-tabs en publieke boekpagina; boekingslinks op de site wijzen naar /booking-app/book/{slug}. Uit: booking-blok en boek-links verborgen op /site.",
      checked: appointments_enabled,
    },
    {
      field: "webshop_enabled",
      label: "Webshop (marketing)",
      hint: "Aan: route /winkel/{slug} en webshop-links op de marketingpagina actief. Uit: shop-sectie en winkel-links verborgen.",
      checked: webshop_enabled,
    },
  ];

  const iframeSnippet = `<iframe title="Afspraak maken" src="${bookingAbsoluteUrl}" width="100%" height="920" style="border:0;border-radius:12px;max-width:42rem"></iframe>`;
  const shopIframeSnippet = `<iframe title="Webshop" src="${shopAbsoluteUrl}" width="100%" height="920" style="border:0;border-radius:12px;max-width:42rem"></iframe>`;

  return (
    <section className="rounded-xl border border-violet-200/90 bg-violet-50/50 p-5 dark:border-violet-900/45 dark:bg-violet-950/25">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
        Portaal-modules
      </h2>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
        Schakel tabbladen per klant aan of uit; wijzigingen zijn direct zichtbaar na verversen van het portaal.
      </p>
      {err ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <ul className="mt-4 divide-y divide-violet-200/80 dark:divide-violet-900/50">
        {rows.map((r) => (
          <li key={r.field} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{r.label}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{r.hint}</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <span className="sr-only">{r.label}</span>
              {busy === r.field ? (
                <Loader2 className="size-5 animate-spin text-violet-700 dark:text-violet-300" aria-hidden />
              ) : (
                <input
                  type="checkbox"
                  checked={r.checked}
                  disabled={busy !== null || bookingAppendBusy !== null || shopAppendBusy !== null}
                  onChange={(e) => void patch(r.field, e.target.checked)}
                  className="size-5 rounded border-zinc-300 accent-violet-700 disabled:opacity-50 dark:border-zinc-600"
                />
              )}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg border border-violet-300/70 bg-white/90 p-4 dark:border-violet-900/50 dark:bg-violet-950/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-200">
          Online boeken op de marketingpagina
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Nieuwe sites:</strong> de AI genereert{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">geen</strong> booking-sectie. Voeg het vaste anker toe
            met de knop hieronder (alleen een dunne lijn vóór de footer; de echte knop staat in de navigatie met{" "}
            <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">__STUDIO_BOOKING_PATH__</code>
            ). De schakelaar Afspraken bepaalt of dat zichtbaar is op{" "}
            <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/site/…</code>.
          </li>
          <li>
            Zet <strong className="text-zinc-800 dark:text-zinc-200">“Afspraken”</strong> aan om portaal + boekpagina +
            zichtbare booking op <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/site/…</code>{" "}
            te activeren. Uit = sectie en links netjes verborgen (zelfde site-data).
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Bestaande site zonder booking-blok:</strong> knop
            hieronder “Standaard booking-blok” (geen AI).
          </li>
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Optioneel (AI):</strong> Site-studio preset voor
            maatwerk-copy.
          </li>
          <li>Preview en publiceren zoals gebruikelijk.</li>
          <li>
            Extern domein: <strong className="text-zinc-800 dark:text-zinc-200">iframe</strong> naar de boek-URL (alleen
            met module aan).
          </li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null || bookingAppendBusy !== null || shopAppendBusy !== null}
            onClick={() => void appendBookingSection(false)}
            className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-60 dark:bg-violet-600 dark:hover:bg-violet-500"
          >
            {bookingAppendBusy === "add" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Standaard booking-blok (geen AI)
          </button>
          <button
            type="button"
            disabled={busy !== null || bookingAppendBusy !== null || shopAppendBusy !== null}
            onClick={() => void appendBookingSection(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-400 bg-white px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/40"
          >
            {bookingAppendBusy === "replace" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Vervang bestaande booking
          </button>
          <Link
            href={studioPresetHref}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950/50"
          >
            Site-studio (preset, AI)
            <ExternalLink className="size-3.5 opacity-90" aria-hidden />
          </Link>
          <Link
            href="/admin/ops/werkwijze"
            className="inline-flex items-center rounded-lg border border-violet-300 px-3 py-2 text-xs font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950/50"
          >
            Veelgestelde vragen
          </Link>
        </div>

        {appointments_enabled ? (
          <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Boek-URL &amp; iframe-voorbeeld
            </summary>
            <p className="mt-2 break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{bookingAbsoluteUrl}</p>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-100">
              {iframeSnippet}
            </pre>
          </details>
        ) : (
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Zet Afspraken aan om de publieke boek-URL en embed te tonen.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-emerald-300/70 bg-white/90 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
          Webshop op de marketingpagina
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <li>
            <strong className="text-zinc-800 dark:text-zinc-200">Nieuwe sites:</strong> de AI genereert{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">geen</strong> shop-sectie. Voeg het standaardblok toe
            met de knop hieronder; de schakelaar Webshop bepaalt of het op{" "}
            <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/site/…</code> zichtbaar is.
          </li>
          <li>
            Zet <strong className="text-zinc-800 dark:text-zinc-200">Webshop</strong> aan om{" "}
            <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/winkel/…</code> en de shop-sectie
            op <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/site/…</code> zichtbaar te
            maken.
          </li>
          <li>
            Ontbreekt het blok: knop hieronder <strong className="text-zinc-800 dark:text-zinc-200">Standaard
            webshop-sectie</strong> (geen AI).
          </li>
          <li>
            Optioneel: externe catalogus via env{" "}
            <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">NEXT_PUBLIC_WEBSHOP_IFRAME_SRC_TEMPLATE</code>.
          </li>
        </ol>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null || bookingAppendBusy !== null || shopAppendBusy !== null}
            onClick={() => void appendShopSection(false)}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {shopAppendBusy === "add" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Standaard webshop-sectie (geen AI)
          </button>
          <button
            type="button"
            disabled={busy !== null || bookingAppendBusy !== null || shopAppendBusy !== null}
            onClick={() => void appendShopSection(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-white px-3 py-2 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
          >
            {shopAppendBusy === "replace" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            Vervang bestaande shop-sectie
          </button>
        </div>
        {webshop_enabled ? (
          <details className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <summary className="cursor-pointer text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Webshop-URL &amp; iframe-voorbeeld
            </summary>
            <p className="mt-2 break-all font-mono text-[11px] text-zinc-600 dark:text-zinc-400">{shopAbsoluteUrl}</p>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-[10px] leading-snug text-zinc-100">
              {shopIframeSnippet}
            </pre>
          </details>
        ) : (
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Zet Webshop aan om de publieke URL en embed te tonen.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Werkdagen en weekplanning voor{" "}
        <code className="rounded bg-zinc-100 px-0.5 text-[10px] dark:bg-zinc-800">/booking-app/book/…</code>{" "}
        beheert de klant in het portaal onder Afspraken (zelfde database als de site).
      </p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Zelfde toggles vind je ook onder{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Commercie &amp; domein → Klantportaal</span>.
      </p>
    </section>
  );
}
