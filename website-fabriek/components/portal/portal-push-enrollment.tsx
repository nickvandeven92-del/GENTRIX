"use client";

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Props = {
  slug: string;
  appointmentsEnabled: boolean;
  studioPreview: boolean;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PortalPushEnrollment({ slug, appointmentsEnabled, studioPreview }: Props) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";

  const enc = encodeURIComponent(decodeURIComponent(slug));
  const subscribeUrl = `/api/portal/clients/${enc}/push/subscribe`;
  const unsubscribeUrl = `/api/portal/clients/${enc}/push/unsubscribe`;

  const [envOk, setEnvOk] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const syncToServer = useCallback(
    async (sub: PushSubscription) => {
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      const res = await fetch(subscribeUrl, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          },
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Opslaan mislukt.");
      }
    },
    [subscribeUrl],
  );

  useEffect(() => {
    if (studioPreview || !appointmentsEnabled || !vapidPublic) {
      setEnvOk(false);
      return;
    }
    setEnvOk(true);
  }, [appointmentsEnabled, studioPreview, vapidPublic]);

  useEffect(() => {
    if (!envOk || typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setPermission("unsupported");
      return;
    }

    setSupported(true);
    setPermission(Notification.permission);

    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (cancelled) return;
        const sub = await reg.pushManager.getSubscription();
        const on = Boolean(sub) && Notification.permission === "granted";
        setSubscribed(on);
        if (sub && Notification.permission === "granted") {
          try {
            await syncToServer(sub);
            setSubscribed(true);
            setErr(null);
          } catch {
            if (!cancelled) {
              setSubscribed(true);
              setErr("Inschrijving op de server vernieuwen mislukt. Gebruik de knop om opnieuw te koppelen.");
            }
          }
        } else {
          setSubscribed(Boolean(sub) && Notification.permission === "granted");
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envOk, syncToServer]);

  async function enablePush() {
    setErr(null);
    setBusy(true);
    try {
      if (!vapidPublic) return;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setSubscribed(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
        }));
      await syncToServer(sub);
      setSubscribed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Meldingen inschakelen mislukt.");
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setErr(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await fetch(unsubscribeUrl, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Uitschakelen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  if (!envOk) return null;

  if (supported === false || permission === "unsupported") {
    return (
      <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-2 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
        Browsermeldingen voor nieuwe afspraken zijn niet beschikbaar in deze browser. Je ontvangt wel mail op je
        factuuradres (indien ingesteld).
      </div>
    );
  }

  if (supported === null) {
    return (
      <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-2 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
        <Loader2 className="mx-auto size-4 animate-spin" aria-hidden />
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="border-b border-amber-200 bg-amber-50/90 px-4 py-2 text-center text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Meldingen zijn geblokkeerd in de browser. Zet ze aan via de site-instellingen van je browser om een seintje te
        krijgen bij een nieuwe online boeking (naast e-mail).
      </div>
    );
  }

  if (subscribed) {
    return (
      <div className="border-b border-emerald-200 bg-emerald-50/80 px-4 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm text-emerald-950 dark:text-emerald-100">
          <p className="flex items-center gap-2">
            <Bell className="size-4 shrink-0" aria-hidden />
            <span>
              Je krijgt een <strong>melding op dit apparaat</strong> bij een nieuwe afspraak (ook als je het portaal
              sluit). Op iPhone werkt dit meestal na &quot;Zet op beginscherm&quot;.
            </span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void disablePush()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 dark:hover:bg-emerald-900"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <BellOff className="size-3.5" aria-hidden />}
            Uitzetten
          </button>
        </div>
        {err ? <p className="mx-auto mt-1 max-w-6xl text-xs text-red-700 dark:text-red-300">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-200 bg-white px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="max-w-3xl">
          Wil je een <strong>seintje op je telefoon of pc</strong> wanneer iemand online boekt — ook als dit tabblad
          dicht is? Schakel browsermeldingen in (naast de e-mail naar je factuuradres).
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void enablePush()}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          Meldingen inschakelen
        </button>
      </div>
      {err ? <p className="mx-auto mt-1 max-w-6xl text-xs text-red-600 dark:text-red-400">{err}</p> : null}
    </div>
  );
}
