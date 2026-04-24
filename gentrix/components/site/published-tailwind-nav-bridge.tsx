"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { publicBookingIframeSrcFromNavHref } from "@/lib/site/public-booking-modal-url";
import {
  isPublishedSiteSoftNavTarget,
  isSameDocumentInPageAnchorNav,
} from "@/lib/site/published-site-soft-nav";
import type { PublishedSiteSoftNavContext } from "@/lib/site/published-site-soft-nav";
import { STUDIO_PUBLIC_NAV_MESSAGE_SOURCE } from "@/lib/site/studio-public-nav-message";

function runWithViewTransition(fn: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(fn);
  } else {
    fn();
  }
}

/**
 * Bridge voor publieke sites — taken:
 *
 * 1. **Boek-modal**: klikken op `/boek/...`-links openen een modal i.p.v. navigeren.
 * 2. **Legacy iframe postMessage**: luistert naar `STUDIO_PUBLIC_NAV_MESSAGE_SOURCE` berichten.
 * 3. **Optioneel SPA-gevoel** (`publishedSiteSoftNav`): interne site-links → `router.push`
 *    + View Transitions; Alpine/Lucide opnieuw via {@link PublishedTailwindInlineClientEffects}.
 *
 * Zonder soft-nav-context: native volledige document-navigatie (betrouwbaar voor willekeurige scripts).
 */
export function PublishedTailwindNavBridge({
  children,
  publishedSiteSoftNav = null,
}: {
  children: ReactNode;
  /** Alleen gezet op publieke inline multipage/contact-routes — dan client-side App Router-nav. */
  publishedSiteSoftNav?: PublishedSiteSoftNavContext | null;
}) {
  const router = useRouter();
  const [bookingModalSrc, setBookingModalSrc] = useState<string | null>(null);
  const closeBookingModal = useCallback(() => setBookingModalSrc(null), []);

  const tryOpenBooking = useCallback((href: string): boolean => {
    try {
      const bookingSrc = publicBookingIframeSrcFromNavHref(href, window.location.origin);
      if (bookingSrc) {
        setBookingModalSrc(bookingSrc);
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }, []);

  const trySoftNavigate = useCallback(
    (absolute: string): boolean => {
      if (!publishedSiteSoftNav) return false;
      try {
        const u = new URL(absolute, window.location.href);
        if (u.origin !== window.location.origin) return false;
        /** Zelfde document + ander fragment: browser laat anker-scroll lopen. */
        if (isSameDocumentInPageAnchorNav(u)) return false;
        if (!isPublishedSiteSoftNavTarget(u, publishedSiteSoftNav)) return false;
        const dest = `${u.pathname}${u.search}${u.hash}`;
        const cur = new URL(window.location.href);
        if (
          u.origin === cur.origin &&
          u.pathname === cur.pathname &&
          u.search === cur.search &&
          u.hash === cur.hash
        ) {
          return false;
        }
        runWithViewTransition(() => {
          router.push(dest);
        });
        return true;
      } catch {
        return false;
      }
    },
    [publishedSiteSoftNav, router],
  );

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const target = e.target as Element | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const rawHref = anchor.getAttribute("href");
      if (!rawHref) return;
      if (rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) return;
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      let absolute: string;
      try {
        absolute = new URL(rawHref, window.location.href).toString();
      } catch {
        return;
      }
      if (tryOpenBooking(absolute)) {
        e.preventDefault();
        return;
      }
      if (trySoftNavigate(absolute)) {
        e.preventDefault();
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [tryOpenBooking, trySoftNavigate]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin && ev.origin !== "null") return;
      const d = ev.data as { source?: string; href?: string };
      if (!d || d.source !== STUDIO_PUBLIC_NAV_MESSAGE_SOURCE || typeof d.href !== "string") return;
      if (tryOpenBooking(d.href)) return;
      try {
        const u = new URL(d.href, window.location.origin);
        if (u.origin !== window.location.origin) return;
        if (trySoftNavigate(u.toString())) return;
        window.location.assign(u.pathname + u.search + u.hash);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [tryOpenBooking, trySoftNavigate]);

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
