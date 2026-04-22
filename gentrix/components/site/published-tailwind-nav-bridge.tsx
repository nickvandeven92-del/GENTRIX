"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { publicBookingIframeSrcFromNavHref } from "@/lib/site/public-booking-modal-url";
import { STUDIO_PUBLIC_NAV_MESSAGE_SOURCE } from "@/lib/site/studio-public-nav-message";

/**
 * Ontvangt navigatie uit de sandboxed marketing-iframe wanneer scripts geen `top.location` mogen zetten.
 * Boek-flow opent in een **modal** op deze pagina (geen volledige tab / geen full-screen weg van de site).
 *
 * Navigatie via `router.push` i.p.v. `window.location.assign`:
 * – Geen volledige browser-reload → JS-bundle blijft in geheugen
 * – `loading.tsx` skeleton verschijnt direct
 * – RSC streamt in → naadloze overgang
 */
export function PublishedTailwindNavBridge({ children }: { children: ReactNode }) {
  const [bookingModalSrc, setBookingModalSrc] = useState<string | null>(null);
  const router = useRouter();

  const closeBookingModal = useCallback(() => setBookingModalSrc(null), []);

  const softNavigate = useCallback(
    (href: string) => {
      const pathname = new URL(href).pathname + new URL(href).search + new URL(href).hash;
      router.push(pathname);
    },
    [router],
  );

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin && ev.origin !== "null") return;
      const d = ev.data as { source?: string; href?: string };
      if (!d || d.source !== STUDIO_PUBLIC_NAV_MESSAGE_SOURCE || typeof d.href !== "string") return;
      try {
        const bookingSrc = publicBookingIframeSrcFromNavHref(d.href, window.location.origin);
        if (bookingSrc) {
          setBookingModalSrc(bookingSrc);
          return;
        }
        const u = new URL(d.href);
        if (u.origin !== window.location.origin) return;
        softNavigate(d.href);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [softNavigate]);

  useEffect(() => {
    if (!bookingModalSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeBookingModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingModalSrc, closeBookingModal]);

  return (
    <>
      {children}
      {bookingModalSrc ? (
        <div
          className="fixed inset-0 z-[5000] flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gentrix-booking-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Sluit boeken"
            onClick={closeBookingModal}
          />
          <div className="relative z-[1] flex max-h-[min(92dvh,900px)] w-full max-w-[440px] flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <h2 id="gentrix-booking-modal-title" className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Afspraak maken
              </h2>
              <button
                type="button"
                onClick={closeBookingModal}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
              >
                <X className="size-3.5" aria-hidden />
                Sluiten
              </button>
            </div>
            <iframe
              title="Online boeken"
              src={bookingModalSrc}
              className="h-[min(78dvh,820px)] w-full shrink-0 border-0 bg-white sm:h-[min(82dvh,860px)]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
