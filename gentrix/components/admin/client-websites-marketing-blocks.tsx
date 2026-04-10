"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  subfolderSlug: string;
  clientOverviewHref: string;
};

/**
 * Zelfde acties als onder Klant → Portaal-modules, maar bereikbaar vanaf Websites voor snelle toegang.
 */
export function ClientWebsitesMarketingBlocks({ subfolderSlug, clientOverviewHref }: Props) {
  const router = useRouter();
  const [bookingBusy, setBookingBusy] = useState<"add" | "replace" | null>(null);
  const [shopBusy, setShopBusy] = useState<"add" | "replace" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function appendBooking(replace: boolean) {
    setBookingBusy(replace ? "replace" : "add");
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/append-booking-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: replace }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Booking-sectie mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setBookingBusy(null);
    }
  }

  async function appendShop(replace: boolean) {
    setShopBusy(replace ? "replace" : "add");
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(subfolderSlug)}/append-shop-section`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: replace }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Webshop-sectie mislukt.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setShopBusy(null);
    }
  }

  const disabled = bookingBusy !== null || shopBusy !== null;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Marketingblokken (concept)</h3>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Voeg standaard booking- of webshop-secties toe aan de <strong className="text-zinc-800 dark:text-zinc-200">Tailwind</strong>
        -draft (zonder AI). Modules aan/uit en live routes stel je in onder{" "}
        <Link href={clientOverviewHref} className="font-medium text-blue-700 underline dark:text-blue-400">
          Klantoverzicht → Portaal-modules
        </Link>
        .
      </p>
      {err ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
        <div className="min-w-[12rem] flex-1 rounded-lg border border-violet-200/90 bg-violet-50/40 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
          <p className="text-xs font-medium text-violet-900 dark:text-violet-200">Boeken</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void appendBooking(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-800 disabled:opacity-60"
            >
              {bookingBusy === "add" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Booking-blok
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void appendBooking(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-400 bg-white px-2.5 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-60 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100"
            >
              {bookingBusy === "replace" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Vervangen
            </button>
          </div>
        </div>
        <div className="min-w-[12rem] flex-1 rounded-lg border border-emerald-200/90 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">Webshop (4 producten)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => void appendShop(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
            >
              {shopBusy === "add" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Webshop-sectie
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void appendShop(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-400 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
            >
              {shopBusy === "replace" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Vervangen
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
