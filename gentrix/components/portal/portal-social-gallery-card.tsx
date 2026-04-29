"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import {
  SocialGallerySettings,
  type SocialConnection,
  type SocialPhoto,
} from "../../frontends/gentrix-photo-grid-main/src/components/SocialGallery";

type SocialProvider = "instagram" | "facebook";
type SocialGalleryLayout = "carousel" | "grid";
type SocialGalleryItem = SocialPhoto;
type SocialSettings = {
  customerOptIn?: boolean;
  enabled: boolean;
  layout: SocialGalleryLayout;
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
  const oauthState = searchParams.get("social_oauth");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SocialGalleryItem[]>([]);
  const [settings, setSettings] = useState<SocialSettings>({
    customerOptIn: true,
    enabled: false,
    layout: "carousel",
    provider: "instagram",
    accountId: "",
    accountHandle: "",
    hasToken: false,
  });

  const oauthMessage = (() => {
    switch (oauthState) {
      case "ok":
        return {
          tone: "success" as const,
          text: 'OAuth koppeling gelukt. Klik op "Nu syncen".',
        };
      case "denied":
        return {
          tone: "error" as const,
          text: "Meta-login is afgebroken of geweigerd. Rond de toestemming volledig af en selecteer de juiste pagina/account.",
        };
      case "no_instagram_business":
        return {
          tone: "error" as const,
          text: "Meta vond geen gekoppeld Instagram bedrijfsaccount. Zet Instagram om naar professioneel en koppel het aan een Facebook-pagina.",
        };
      case "no_page":
        return {
          tone: "error" as const,
          text: "Meta gaf geen Facebook-pagina met paginatoken terug. Kies in Meta de juiste pagina en geef alle pagina-toestemmingen toestemming.",
        };
      case "token_error":
      case "token_empty":
        return {
          tone: "error" as const,
          text: "Meta gaf geen geldig toegangstoken terug. Probeer opnieuw en rond alle toestemmingsstappen af.",
        };
      case "state_error":
        return {
          tone: "error" as const,
          text: "De koppelsessie is verlopen of ongeldig geworden. Start de Instagram-koppeling opnieuw vanuit het portaal.",
        };
      case "network_error":
        return {
          tone: "error" as const,
          text: "Meta reageerde niet op tijd. Probeer de koppeling opnieuw.",
        };
      case "forbidden":
        return {
          tone: "error" as const,
          text: "Je hebt geen toegang tot deze portal-koppeling. Log opnieuw in en probeer het nog eens.",
        };
      case "rate_limited":
        return {
          tone: "error" as const,
          text: "Er zijn te veel koppelpogingen kort na elkaar gedaan. Wacht even en probeer opnieuw.",
        };
      case "crypto_error":
      case "no_client":
        return {
          tone: "error" as const,
          text: "De koppeling kon niet opgeslagen worden. Probeer opnieuw; blijft dit gebeuren, dan zit het aan de serverkant.",
        };
      default:
        return null;
    }
  })();

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

  async function updateEnabled(nextEnabled: boolean) {
    setSaving(true);
    setError(null);
    setSettings((s) => ({ ...s, enabled: nextEnabled }));
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: {
            enabled: nextEnabled,
            layout: settings.layout,
            provider: settings.provider,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Opslaan mislukt.");
      setSettings(json.settings);
    } catch (e) {
      setSettings((s) => ({ ...s, enabled: !nextEnabled }));
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function updateLayout(nextLayout: SocialGalleryLayout) {
    setSaving(true);
    setError(null);
    setSettings((s) => ({ ...s, layout: nextLayout }));
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: {
            enabled: settings.enabled,
            layout: nextLayout,
            provider: settings.provider,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Opslaan mislukt.");
      setSettings(json.settings);
    } catch (e) {
      setSettings((s) => ({ ...s, layout: nextLayout === "carousel" ? "grid" : "carousel" }));
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function connectWithProvider(provider: SocialProvider) {
    setSettings((s) => ({ ...s, provider }));
    const href = `/api/portal/clients/${encodeURIComponent(slug)}/social-gallery/oauth/start?provider=${provider}`;
    window.location.href = href;
  }

  async function disconnectSocial() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: {
            enabled: false,
            layout: settings.layout,
            provider: settings.provider,
            accountId: "",
            accountHandle: "",
            accessToken: "",
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Ontkoppelen mislukt.");
      if (json.settings) setSettings(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ontkoppelen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function persistManualPhotos(nextPhotos: SocialPhoto[]) {
    setSaving(true);
    setError(null);
    setItems(nextPhotos.slice(0, 9));
    try {
      const res = await fetch(`/api/portal/clients/${encodeURIComponent(slug)}/social-gallery`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settings: {
            enabled: settings.enabled,
            layout: settings.layout,
            provider: settings.provider,
          },
          items: nextPhotos.slice(0, 9),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "Opslaan mislukt.");
      if (Array.isArray(json.items)) setItems(json.items);
      if (json.settings) setSettings(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
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
            onChange={(e) => void updateEnabled(e.target.checked)}
            disabled={saving}
          />
          {saving ? "Opslaan..." : "Actief"}
        </label>
      </div>
      {settings.customerOptIn === false ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Je hebt social gallery tijdens bestellen uitgezet — zet hem hier weer aan als je wilt.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing || !settings.enabled}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCcw className="size-4" />
          {syncing ? "Syncen..." : "Nu syncen"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Instagram opent ook het Meta/Facebook inlogscherm. Dat is normaal: Meta levert daarna je Instagram business-account of Facebook-pagina terug.
      </p>
      <div className="mt-4">
        <SocialGallerySettings
          connection={
            settings.accountHandle?.trim()
              ? ({
                  provider: settings.provider,
                  handle: settings.accountHandle,
                } satisfies SocialConnection)
              : null
          }
          onConnect={(provider) => connectWithProvider(provider)}
          onDisconnect={() => disconnectSocial()}
          layout={settings.layout}
          onLayoutChange={(nextLayout) => void updateLayout(nextLayout)}
          photos={items}
          onPhotosChange={(next) => void persistManualPhotos(next)}
        />
      </div>

      {settings.enabled ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-900/50 dark:bg-blue-950/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">
            Zo maak je je content zichtbaar
          </p>
          <ol className="mt-2 space-y-2 text-sm text-blue-950 dark:text-blue-100">
            <li className="animate-[fadeSlideIn_.25s_ease-out]">1. Klik op “Verbind met Instagram” of “Verbind met Facebook”.</li>
            <li className="animate-[fadeSlideIn_.35s_ease-out]">2. Log in bij Meta en geef toegang tot je pagina/account.</li>
            <li className="animate-[fadeSlideIn_.45s_ease-out]">3. Terug in het portaal: klik op “Nu syncen”.</li>
            <li className="animate-[fadeSlideIn_.55s_ease-out]">4. Je 9 nieuwste posts worden daarna automatisch getoond op je landingspagina.</li>
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
      {oauthMessage ? (
        <p
          className={`mt-2 text-sm ${
            oauthMessage.tone === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {oauthMessage.text}
        </p>
      ) : null}
      {oauthState === "missing_env" ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Meta app ontbreekt nog in serverconfiguratie</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs">
            <li>Ga naar developers.facebook.com en open je app.</li>
            <li>Kopieer App ID en App Secret uit Settings -&gt; Basic.</li>
            <li>Zet ze in Vercel als META_APP_ID en META_APP_SECRET.</li>
            <li>Redeploy en klik daarna opnieuw op Koppel via OAuth.</li>
          </ol>
          <a
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900/60"
          >
            Open Meta Developers
          </a>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {items.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {items.slice(0, 9).map((item) => (
            <div key={item.id} className="aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.caption ?? ""} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
