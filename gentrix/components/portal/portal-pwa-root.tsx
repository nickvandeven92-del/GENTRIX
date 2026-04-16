"use client";

import { Download, Share, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Alleen deze browsersessie (tab tot je sluit). */
const SESSION_DISMISS_KEY = "portal-pwa-install-dismissed";
/** Permanent op dit apparaat (localStorage). */
const PERMANENT_DISMISS_KEY = "portal-pwa-install-never-show";

/** Portaal, centrale entry-routes én studio (/admin → /admin/ops). */
function isPwaShellPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/home" || pathname === "/dashboard") return true;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  return pathname.startsWith("/portal/");
}

function isAdminStudioPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readInstallBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(PERMANENT_DISMISS_KEY) === "1") return true;
    if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === "1") return true;
  } catch {
    /* private mode / blocked storage */
  }
  return false;
}

/** True wanneer de app als geïnstalleerde PWA draait (niet in een normale browsertab). */
function computeStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  const modes = ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"] as const;
  for (const mode of modes) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function PortalPwaRoot() {
  const pathname = usePathname();
  const active = isPwaShellPath(pathname);
  const studioCopy = isAdminStudioPath(pathname);

  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useLayoutEffect(() => {
    setDismissed(readInstallBannerDismissed());
    setStandalone(computeStandaloneDisplay());
  }, []);

  useEffect(() => {
    if (standalone) setDeferred(null);
  }, [standalone]);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    const refreshStandalone = () => setStandalone(computeStandaloneDisplay());
    const mqs: MediaQueryList[] = [];
    for (const mode of ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"] as const) {
      try {
        const mq = window.matchMedia(`(display-mode: ${mode})`);
        mq.addEventListener("change", refreshStandalone);
        mqs.push(mq);
      } catch {
        /* ignore */
      }
    }
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", refreshStandalone);
    };
  }, [active]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
    /** Lokaal altijd registreren zodat een nieuwe sw.js (zonder fetch-intercept op localhost) actief wordt, ook vanaf /login. */
    if (!isLocal && !active) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, [active]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    setStandalone(computeStandaloneDisplay());

    const ua = navigator.userAgent || "";
    const isIos = /iPad|iPhone|iPod/.test(ua);
    setIosHint(isIos && !computeStandaloneDisplay());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEventLike);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, [active]);

  const dismissSession = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const dismissPermanent = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(PERMANENT_DISMISS_KEY, "1");
      sessionStorage.removeItem(SESSION_DISMISS_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const runInstall = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        try {
          localStorage.setItem(PERMANENT_DISMISS_KEY, "1");
          sessionStorage.removeItem(SESSION_DISMISS_KEY);
        } catch {
          /* ignore */
        }
        setDismissed(true);
      }
    } catch {
      /* ignore */
    } finally {
      setDeferred(null);
      setInstalling(false);
    }
  }, [deferred]);

  if (!active || standalone || dismissed) return null;

  if (deferred) {
    return (
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[100] border-t border-zinc-200 bg-white p-4 shadow-lg",
          "dark:border-zinc-800 dark:bg-zinc-900",
        )}
        role="region"
        aria-label="App installeren"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              {studioCopy ? "Installeer de studio" : "Installeer het portaal"}
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
              {studioCopy
                ? "Snelkoppeling naar je dashboard; statische assets worden gecached, data blijft online."
                : "Snelkoppeling op je startscherm; werkt offline beperkt (geen live data zonder internet)."}
            </span>
            {studioCopy ? (
              <span className="mt-1 block text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
                Sta je al in de geïnstalleerde app? Open die via je snelkoppeling (venster zonder browsertabbladen). In een
                gewone tab kan Chrome dit alsnog aanbieden — gebruik dan <strong className="font-medium text-zinc-600 dark:text-zinc-400">Niet meer tonen</strong>.
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runInstall()}
              disabled={installing}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              <Download className="size-4 shrink-0" aria-hidden />
              {installing ? "Bezig…" : "Installeren"}
            </button>
            <button
              type="button"
              onClick={dismissPermanent}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
              title="Banner komt niet meer terug op dit apparaat (tenzij je sitegegevens wist)."
            >
              Niet meer tonen
            </button>
            <button
              type="button"
              onClick={dismissSession}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Sluiten (alleen deze sessie)"
              title="Verbergt de banner tot je de browser sluit of een nieuw tabblad opent."
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (iosHint) {
    return (
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[100] border-t border-zinc-200 bg-white p-4 shadow-lg",
          "dark:border-zinc-800 dark:bg-zinc-900",
        )}
        role="region"
        aria-label="Toevoegen aan beginscherm"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-3">
          <p className="flex gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <Share className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
            <span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">iPhone / iPad</span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                Tik op <strong className="text-zinc-700 dark:text-zinc-300">Deel</strong> en kies{" "}
                <strong className="text-zinc-700 dark:text-zinc-300">Zet op beginscherm</strong> om{" "}
                {studioCopy ? "de studio" : "het portaal"} als app te gebruiken.
              </span>
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={dismissPermanent}
              className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Niet meer tonen
            </button>
            <button
              type="button"
              onClick={dismissSession}
              className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Sluiten (alleen deze sessie)"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
