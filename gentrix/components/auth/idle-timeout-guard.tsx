"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  SALES_OS_IDLE_LOGOUT_MINUTES,
  SALES_OS_IDLE_LOGOUT_MS,
  SALES_OS_IDLE_WARNING_LEAD_MINUTES,
  SALES_OS_IDLE_WARNING_MS,
} from "@/lib/config/idle-timeout";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TICK_INTERVAL_MS = 10_000; // elke 10 seconden controleren

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
  "pointerdown",
];

/**
 * Bewaakt inactiviteit in de admin/CRM-omgeving.
 * Waarschuwing na 9 minuten, automatisch uitloggen na 10 minuten.
 * Mounts niet-zichtbaar; toont alleen een overlay bij inactiviteit.
 */
export function IdleTimeoutGuard() {
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SALES_OS_IDLE_WARNING_LEAD_MINUTES * 60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [showWarning]);

  const doSignOut = useCallback(async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    await fetch("/api/auth/mfa-email/clear-cookie", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  // Activiteits-listeners bijhouden
  useEffect(() => {
    const handler = () => resetActivity();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, handler, { passive: true }));
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, handler));
    };
  }, [resetActivity]);

  // Hoofd-timer: controleer elke 10 seconden op inactiviteit
  useEffect(() => {
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= SALES_OS_IDLE_LOGOUT_MS) {
        clearInterval(interval);
        void doSignOut();
      } else if (idle >= SALES_OS_IDLE_WARNING_MS && !showWarning) {
        setShowWarning(true);
        setSecondsLeft(Math.ceil((SALES_OS_IDLE_LOGOUT_MS - idle) / 1000));
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [doSignOut, showWarning]);

  // Afteltimer zodra waarschuwing zichtbaar is
  useEffect(() => {
    if (!showWarning) return;

    countdownRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      const remaining = Math.max(0, Math.ceil((SALES_OS_IDLE_LOGOUT_MS - idle) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        void doSignOut();
      }
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showWarning, doSignOut]);

  if (!showWarning) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-desc"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-neutral-950/50 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-3">
          {/* Klok-icoon */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </span>
          <h2 id="idle-warning-title" className="text-sm font-semibold text-neutral-900 dark:text-zinc-100">
            Sessie verloopt bijna
          </h2>
        </div>

        <p id="idle-warning-desc" className="mb-5 text-sm text-neutral-600 dark:text-zinc-400">
          Je bent langer dan {SALES_OS_IDLE_LOGOUT_MINUTES - SALES_OS_IDLE_WARNING_LEAD_MINUTES} minuten inactief.
          Vanwege vertrouwelijke informatie word je automatisch uitgelogd over{" "}
          <span className="font-semibold tabular-nums text-neutral-900 dark:text-zinc-100">
            {secondsLeft}
          </span>{" "}
          seconde{secondsLeft !== 1 ? "n" : ""}.
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={resetActivity}
            className="flex-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Blijf ingelogd
          </button>
          <button
            type="button"
            onClick={() => void doSignOut()}
            className="flex-1 rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Nu uitloggen
          </button>
        </div>
      </div>
    </div>
  );
}
