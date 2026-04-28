"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";

type SocialProvider = "instagram" | "facebook";
type SocialGalleryItem = { id: string; url: string; caption?: string };
type SocialSettings = {
  customerOptIn?: boolean;
  enabled: boolean;
  provider: SocialProvider;
  accountId?: string;
  accountHandle?: string;
  hasToken?: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
};

type Props = { slug: string };

export function PortalSocialGalleryCard({ slug }: Props) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SocialGalleryItem[]>([]);
  const [tokenInput, setTokenInput] = useState("");
  const [settings, setSettings] = useState<SocialSettings>({
    customerOptIn: true,
    enabled: false,
    provider: "instagram",
    accountId: "",
    accountHandle: "",
    hasToken: false,
  });
  const showHowTo = settings.enabled && !settings.hasToken;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Laden mislukt.");
        setSettings(json.settings);
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Laden mislukt.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          provider: settings.provider,
          accountId: settings.accountId ?? "",
          accountHandle: settings.accountHandle ?? "",
          ...(tokenInput.trim() ? { accessToken: tokenInput.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Opslaan mislukt.");
      setSettings(json.settings);
      setTokenInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function connectWithMeta() {
    setConnecting(true);
    const href = `/api/portal/clients/${encodeURIComponent(slug)}/social-gallery/oauth/start?provider=${settings.provider}`;
    window.location.href = href;
  }

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Sync mislukt.");
      setSettings(json.settings);
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync mislukt.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">Social gallery laden...</section>;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Social gallery op landing</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Toont automatisch de 9 nieuwste Instagram/Facebook foto&apos;s op je publieke landingspagina.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
          />
          Actief
        </label>
      </div>
      {settings.customerOptIn === false ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Je hebt social gallery tijdens bestellen uitgezet — zet hem hier weer aan als je wilt.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-zinc-700 dark:text-zinc-200">
          Provider
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={settings.provider}
            onChange={(e) => setSettings((s) => ({ ...s, provider: e.target.value as SocialProvider }))}
          >
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
          </select>
        </label>
        <label className="text-sm text-zinc-700 dark:text-zinc-200">
          Account ID (Meta)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={settings.accountId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, accountId: e.target.value }))}
            placeholder="bijv. IG user id of FB page id"
          />
        </label>
        <label className="text-sm text-zinc-700 dark:text-zinc-200">
          Handle (optioneel)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={settings.accountHandle ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, accountHandle: e.target.value }))}
            placeholder="bijv. salon_naam"
          />
        </label>
        <label className="text-sm text-zinc-700 dark:text-zinc-200">
          Access token
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={settings.hasToken ? "Token aanwezig (nieuw token optioneel)" : "Meta Graph token"}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
        <button
          type="button"
          onClick={connectWithMeta}
          disabled={connecting}
          className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-70 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60"
        >
          {connecting ? "Doorsturen..." : `Koppel via ${settings.provider === "instagram" ? "Instagram" : "Facebook"} OAuth`}
        </button>
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCcw className="size-4" />
          {syncing ? "Syncen..." : "Nu syncen"}
        </button>
      </div>

      {showHowTo ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
            Volgende stappen
          </p>
          <ol className="mt-2 space-y-2 text-sm text-blue-950 dark:text-blue-100">
            <li className="animate-[fadeSlideIn_.25s_ease-out]">1. Klik op “Koppel via {settings.provider === "instagram" ? "Instagram" : "Facebook"} OAuth”.</li>
            <li className="animate-[fadeSlideIn_.35s_ease-out]">2. Log in bij Meta en geef toestemming.</li>
            <li className="animate-[fadeSlideIn_.45s_ease-out]">3. Terug in portaal: klik op “Nu syncen”.</li>
          </ol>
          <style>{`
            @keyframes fadeSlideIn {
              0% { opacity: 0; transform: translateY(6px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Laatste sync: {settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : "nog niet"}{" "}
        {settings.lastSyncStatus ? `- ${settings.lastSyncStatus}` : ""}
      </p>
      {searchParams.get("social_oauth") === "ok" ? (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">OAuth koppeling gelukt. Klik op &quot;Nu syncen&quot;.</p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.slice(0, 9).map((item) => (
          <div key={item.id} className="aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.url} alt={item.caption ?? ""} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
