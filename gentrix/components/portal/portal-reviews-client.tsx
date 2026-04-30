"use client";

import { useEffect, useMemo, useState } from "react";

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

  const base = `/api/portal/clients/${encodeURIComponent(decodeURIComponent(slug))}/reviews`;
  const oauthStartBase = `/api/portal/clients/${encodeURIComponent(decodeURIComponent(slug))}/reviews/oauth/start`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(base, { credentials: "include" });
        const json = (await res.json()) as { ok?: boolean; error?: string; settings?: Settings; items?: Item[] };
        if (!res.ok || !json.ok) throw new Error(json.error || "Kan reviewinstellingen niet laden.");
        if (cancelled) return;
        setSettings(json.settings ?? initialSettings);
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Onbekende fout.");
      } finally {
        if (!cancelled) setLoading(false);
      }
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
    const resolved = oauthStatusToNl(status);
    if (resolved.kind === "success") {
      setSuccess(resolved.message);
      setError(null);
      if (status === "google_ok") setOauthAutoSync("google");
      if (status === "trustpilot_ok") setOauthAutoSync("trustpilot");
    } else {
      setError(resolved.message);
    }

    // Keep status feedback once, but remove query param so refresh won't trigger sync again.
    p.delete("reviews_oauth");
    const query = p.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
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
    } finally {
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Reviewinstellingen laden...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Bron koppelen</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{statusLine}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, platform: "google", identifier: "" }))}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              settings.platform === "google"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            Google Reviews
          </button>
          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, platform: "trustpilot", identifier: "" }))}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              settings.platform === "trustpilot"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            }`}
          >
            Trustpilot
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={syncing}
            onClick={() => {
              window.location.href = `${oauthStartBase}?provider=google`;
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Inloggen met Google
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={() => {
              window.location.href = `${oauthStartBase}?provider=trustpilot`;
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Inloggen met Trustpilot
          </button>
        </div>

        {settings.connected || settings.businessName || settings.identifier ? (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">
              {settings.businessName || (settings.platform === "google" ? "Google-bron gekoppeld" : "Trustpilot-bron gekoppeld")}
            </p>
            {settings.identifier ? (
              <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                {settings.platform === "google" ? "Place ID" : "Domein"}: {settings.identifier}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {syncing ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            Bezig met synchroniseren. Even wachten, we halen nu de laatste reviews op.
          </div>
        ) : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={syncing}
            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
          >
            Loskoppelen
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Voorbeeld van huidige live set</h3>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Nog geen live reviews in cache. Na synchroniseren worden ze automatisch in je gegenereerde review-borders gezet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.slice(0, 4).map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.authorName}</p>
                <p className="text-zinc-700 dark:text-zinc-300">{item.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
