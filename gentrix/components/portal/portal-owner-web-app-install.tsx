"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PortalOwnerWebAppInstall({ dashboardUrl }: { dashboardUrl: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () => {
      const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setStandalone(mq.matches || iosStandalone);
    };
    sync();
    mq.addEventListener("change", sync);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      mq.removeEventListener("change", sync);
    };
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      setDeferred(null);
    }
  }, [deferred]);

  if (standalone) {
    return (
      <p className="text-sm text-emerald-900/90 dark:text-emerald-100/90">
        Je gebruikt de <strong>Boekingen-app</strong> al als geïnstalleerde web app.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          Open boekingen-app
        </a>
        {deferred ? (
          <button
            type="button"
            onClick={() => void onInstallClick()}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-50 dark:hover:bg-emerald-900/50"
          >
            <Download className="size-4 shrink-0" aria-hidden />
            App installeren
          </button>
        ) : null}
      </div>
      <div className="flex gap-2 rounded-lg border border-emerald-900/10 bg-white/60 p-3 text-xs text-emerald-950/85 dark:border-emerald-200/10 dark:bg-emerald-950/30 dark:text-emerald-50/90">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-emerald-800 dark:text-emerald-200" aria-hidden />
        <div className="space-y-1.5">
          <p>
            <strong>Android (Chrome):</strong> open eerst «Open boekingen-app». Verschijnt de knop «App installeren» niet? Menu (⋮) →{" "}
            <em>App installeren</em> of <em>Zet op startscherm</em>.
          </p>
          <p>
            <strong>iPhone / iPad (Safari):</strong> open de boekingen-app → tik op <strong>Deel</strong> → <strong>Zet op beginscherm</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
