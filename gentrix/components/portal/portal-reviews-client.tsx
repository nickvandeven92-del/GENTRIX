"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* Icon components */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function TrustpilotIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12,2 14.9,8.6 22,9.3 16.6,14 18.3,21 12,17.3 5.7,21 7.4,14 2,9.3 9.1,8.6" />
    </svg>
  );
}

type Platform = "google" | "trustpilot";
type Settings = {
  enabled: boolean;
  platform: Platform;
  identifier: string;
  businessName: string;
  connected: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
};
type Item = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  date: string;
  platform: Platform;
};

type Props = { slug: string };

const OAUTH_TAB_NAME = "gentrix-reviews-oauth";
const OAUTH_RESULT_STORAGE_KEY = "gentrix:reviews:oauth-result";

const initialSettings: Settings = {
  enabled: false,
  platform: "google",
  identifier: "",
  businessName: "",
  connected: false,
  lastSyncAt: null,
  lastSyncStatus: null,
};

function oauthStatusToNl(status: string): { kind: "success" | "error"; message: string } {
  const map: Record<string, { kind: "success" | "error"; message: string }> = {
    google_ok: {
      kind: "success",
      message: "Google-koppeling gelukt. We starten nu automatisch met synchroniseren.",
    },
    trustpilot_ok: {
      kind: "success",
      message: "Trustpilot-koppeling gelukt. We starten nu automatisch met synchroniseren.",
    },
    denied: {
      kind: "error",
      message: "Inloggen is geannuleerd. Probeer het opnieuw als je wilt koppelen.",
    },
    state_error: {
      kind: "error",
      message: "De koppeling kon niet worden afgerond door een ongeldige sessiestatus. Probeer opnieuw.",
    },
    forbidden: {
      kind: "error",
      message: "Je hebt geen toegang om reviews voor deze klant te koppelen.",
    },
    rate_limited: {
      kind: "error",
      message: "Te veel koppelpogingen in korte tijd. Wacht even en probeer opnieuw.",
    },
    missing_google_env: {
      kind: "error",
      message: "Google-koppeling is nog niet geconfigureerd op de server. Neem contact op met de studio.",
    },
    missing_trustpilot_env: {
      kind: "error",
      message: "Trustpilot-koppeling is nog niet geconfigureerd op de server. Neem contact op met de studio.",
    },
    google_token_error: {
      kind: "error",
      message: "Google-token ophalen is mislukt. Probeer opnieuw.",
    },
    google_token_empty: {
      kind: "error",
      message: "Google gaf geen geldig toegangstoken terug. Probeer opnieuw.",
    },
    google_accounts_error: {
      kind: "error",
      message: "Google bedrijfsaccounts konden niet worden opgehaald. Probeer opnieuw.",
    },
    google_no_place: {
      kind: "error",
      message: "Er is geen bruikbare Google-bedrijfslocatie gevonden om automatisch reviews te koppelen.",
    },
    trustpilot_token_error: {
      kind: "error",
      message: "Trustpilot-token ophalen is mislukt. Probeer opnieuw.",
    },
    trustpilot_token_empty: {
      kind: "error",
      message: "Trustpilot gaf geen geldig toegangstoken terug. Probeer opnieuw.",
    },
    trustpilot_no_business_unit: {
      kind: "error",
      message: "Er is geen Trustpilot-bedrijf gevonden dat we automatisch konden koppelen.",
    },
    no_client: {
      kind: "error",
      message: "Klantrecord niet gevonden. Vernieuw de pagina en probeer opnieuw.",
    },
    network_error: {
      kind: "error",
      message: "Netwerkfout tijdens koppelen. Controleer je verbinding en probeer opnieuw.",
    },
  };
  return (
    map[status] ?? {
      kind: "error",
      message: "Koppelen is niet gelukt door een onbekende fout. Probeer opnieuw of neem contact op met support.",
    }
  );
}

export function PortalReviewsClient({ slug }: Props) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [oauthAutoSync, setOauthAutoSync] = useState<Platform | null>(null);
  const [oauthInFlight, setOauthInFlight] = useState<Platform | null>(null);
  const oauthPollRef = useRef<number | null>(null);

  const base = `/api/portal/clients/${encodeURIComponent(decodeURIComponent(slug))}/reviews`;
  const oauthStartBase = `/api/portal/clients/${encodeURIComponent(decodeURIComponent(slug))}/reviews/oauth/start`;

  function clearOauthPoll() {
    if (oauthPollRef.current != null) {
      window.clearInterval(oauthPollRef.current);
      oauthPollRef.current = null;
    }
  }

  async function loadState() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(base, { credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; error?: string; settings?: Settings; items?: Item[] };
      if (!res.ok || !json.ok) throw new Error(json.error || "Kan reviewinstellingen niet laden.");
      setSettings(json.settings ?? initialSettings);
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout.");
    } finally {
      setLoading(false);
    }
  }

  async function applyOauthStatus(status: string) {
    const resolved = oauthStatusToNl(status);
    if (resolved.kind === "success") {
      const provider = status === "trustpilot_ok" ? "trustpilot" : "google";
      // Optimistic UI: toon direct gekoppelde provider als groen.
      setSettings((prev) => ({
        ...prev,
        connected: true,
        enabled: true,
        platform: provider,
      }));
      setSuccess(resolved.message);
      setError(null);
      if (status === "google_ok") setOauthAutoSync("google");
      if (status === "trustpilot_ok") setOauthAutoSync("trustpilot");
      clearOauthPoll();
      setOauthInFlight(null);
      await loadState();
      return;
    }
    clearOauthPoll();
    setOauthInFlight(null);
    setSuccess(null);
    setError(resolved.message);
    await loadState();
  }

  function stripOauthStatusFromUrl() {
    const p = new URLSearchParams(window.location.search);
    if (!p.has("reviews_oauth")) return;
    p.delete("reviews_oauth");
    const query = p.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function openOauthInNewTab(provider: Platform) {
    const targetUrl = `${oauthStartBase}?provider=${provider}`;
    const win = window.open(targetUrl, OAUTH_TAB_NAME);
    if (!win) {
      window.location.href = targetUrl;
      return;
    }
    setOauthInFlight(provider);
    clearOauthPoll();
    oauthPollRef.current = window.setInterval(() => {
      if (win.closed) {
        clearOauthPoll();
        setOauthInFlight(null);
        void loadState();
      }
    }, 800);
    win.focus();
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      await loadState();
      if (cancelled) return;
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [base]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const status = p.get("reviews_oauth");
    if (!status) return;
    const fromOauthTab = window.name === OAUTH_TAB_NAME;

    if (fromOauthTab) {
      localStorage.setItem(OAUTH_RESULT_STORAGE_KEY, JSON.stringify({ status, at: Date.now() }));
      stripOauthStatusFromUrl();
      window.close();
      return;
    }

    void applyOauthStatus(status);
    stripOauthStatusFromUrl();
  }, []);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== OAUTH_RESULT_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as { status?: string };
        if (typeof parsed.status !== "string") return;
        void applyOauthStatus(parsed.status);
      } catch {
        // ignore malformed cross-tab message
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    return () => {
      clearOauthPoll();
    };
  }, []);

  useEffect(() => {
    if (!oauthAutoSync) return;
    void (async () => {
      setSuccess(`Koppeling met ${oauthAutoSync === "google" ? "Google" : "Trustpilot"} gelukt. Automatisch synchroniseren...`);
      try {
        await syncNow();
      } finally {
        setOauthAutoSync(null);
      }
    })();
  }, [oauthAutoSync]);

  const placeHolderMode = !settings.enabled || items.length === 0;
  const isConnected = settings.connected || Boolean(settings.identifier.trim());
  const isEnabledOnSite = settings.enabled && isConnected;
  const statusLine = useMemo(() => {
    if (placeHolderMode) return "Website gebruikt nu tijdelijke previewreviews.";
    const stamp = settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString("nl-NL") : "onbekend";
    return `Live reviews actief (${items.length} in cache). Laatste sync: ${stamp}.`;
  }, [items.length, placeHolderMode, settings.lastSyncAt]);

  async function syncNow() {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(base, { method: "POST", credentials: "include" });
      const json = (await res.json()) as { ok?: boolean; error?: string; settings?: Settings; items?: Item[] };
      if (!res.ok || !json.ok) throw new Error(json.error || "Synchroniseren mislukt.");
      if (json.settings) setSettings(json.settings);
      setItems(Array.isArray(json.items) ? json.items : []);
      setSuccess("Reviews gesynchroniseerd. Live data overschrijft nu de placeholders op de website.");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Onbekende fout.";
      setError(`Synchroniseren mislukt: ${detail}`);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disconnect: true }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; settings?: Settings };
      if (!res.ok || !json.ok) throw new Error(json.error || "Loskoppelen mislukt.");
      setSettings(json.settings ?? initialSettings);
      setItems([]);
      setSuccess("Reviewbron losgekoppeld. Website toont weer placeholders.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout.");
    }
  }

  async function toggleEnabled() {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(base, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { enabled: !settings.enabled } }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; settings?: Settings };
      if (!res.ok || !json.ok) throw new Error(json.error || "Kunnen review systeem niet wijzigen.");
      if (json.settings) setSettings(json.settings);
      const action = !settings.enabled ? "ingeschakeld" : "uitgeschakeld";
      setSuccess(`Review systeem ${action}. Website toont ${!settings.enabled ? "live reviews" : "placeholders"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout.");
    }
  }

  async function activateOnSite() {
    if (!isConnected) {
      setError("Je moet eerst een bron koppelen voordat je dit op de site kunt activeren.");
      return;
    }
    await toggleEnabled();
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Reviewinstellingen laden...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Bron koppelen</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{statusLine}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={syncing || Boolean(oauthInFlight) || (isConnected && settings.platform !== "google")}
            onClick={() => {
              if (isConnected && settings.platform === "google") return;
              openOauthInNewTab("google");
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 transition ${
              isConnected && settings.platform === "google"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/60 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-zinc-300 bg-white text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            <GoogleIcon />
            <span>Google {isConnected && settings.platform === "google" ? "✓" : ""}</span>
          </button>
          <button
            type="button"
            disabled={syncing || Boolean(oauthInFlight) || (isConnected && settings.platform !== "trustpilot")}
            onClick={() => {
              if (isConnected && settings.platform === "trustpilot") return;
              openOauthInNewTab("trustpilot");
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 transition ${
              isConnected && settings.platform === "trustpilot"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/60 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-zinc-300 bg-white text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            <TrustpilotIcon />
            <span>Trustpilot {isConnected && settings.platform === "trustpilot" ? "✓" : ""}</span>
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-medium">❌ Koppeling mislukt</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : null}

        {syncing ? (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            <p className="font-medium">🔄 Bezig met synchroniseren</p>
            <p className="mt-1">We halen nu de reviews op van {settings.platform === "google" ? "Google" : "Trustpilot"}...</p>
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">✅ {success}</p>
          </div>
        ) : null}

        {isConnected && !success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">✓ Bron gekoppeld en actief</p>
            <p className="mt-1">{settings.businessName || (settings.platform === "google" ? "Google Reviews" : "Trustpilot")}</p>
            {settings.identifier ? (
              <p className="mt-1 text-xs">
                {settings.platform === "google" ? "Place ID" : "Domein"}: <code className="font-mono">{settings.identifier}</code>
              </p>
            ) : null}
            {settings.lastSyncAt ? (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                Laatste sync: {new Date(settings.lastSyncAt).toLocaleString("nl-NL")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void activateOnSite()}
            disabled={syncing || !isConnected}
            className={`rounded-lg px-4 py-2 text-sm font-medium border ${
              isEnabledOnSite
                ? "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
            }`}
          >
            {isEnabledOnSite ? "📴 Uitschakelen op website" : "▶ Inschakelen op website"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={syncing || !isConnected}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60 hover:bg-red-50 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300"
          >
            {isConnected ? "🔗 Loskoppelen" : "Niet gekoppeld"}
          </button>
        </div>
      </div>
    </section>
  );
}
