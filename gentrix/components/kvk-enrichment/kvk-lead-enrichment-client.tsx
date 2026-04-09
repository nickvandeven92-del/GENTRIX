"use client";

import { useCallback, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { EnrichedLeadPayload } from "@/lib/leads/kvk-enrichment-types";
import type { KvkSearchResultItem } from "@/lib/leads/kvk-enrichment-types";

type SearchResponse = {
  ok: boolean;
  data?: {
    items: KvkSearchResultItem[];
    pagina: number;
    resultatenPerPagina: number;
    totaal: number;
  };
  error?: unknown;
};

const STATUS_LABEL: Record<string, string> = {
  geen_website: "Geen website",
  website_kapot: "Website kapot / onbereikbaar",
  website_zwak: "Website zwak",
  website_redelijk: "Website redelijk",
  website_sterk: "Website sterk",
};

export function KvkLeadEnrichmentClient() {
  const [q, setQ] = useState("");
  const [plaats, setPlaats] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<KvkSearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<KvkSearchResultItem | null>(null);
  const [manualUrl, setManualUrl] = useState("");

  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState<EnrichedLeadPayload | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [dbNote, setDbNote] = useState<string | null>(null);

  const onSearch = useCallback(async () => {
    setSearchError(null);
    setResults([]);
    setSelected(null);
    setEnriched(null);
    const params = new URLSearchParams();
    params.set("q", q.trim());
    if (plaats.trim()) params.set("plaats", plaats.trim());
    setSearching(true);
    try {
      const res = await fetch(`/api/kvk/search?${params.toString()}`, { credentials: "include" });
      const json = (await res.json()) as SearchResponse;
      if (!res.ok || !json.ok || !json.data) {
        const err =
          typeof json.error === "string"
            ? json.error
            : JSON.stringify(json.error ?? `HTTP ${res.status}`);
        setSearchError(err);
        return;
      }
      setResults(json.data.items);
    } catch {
      setSearchError("Netwerkfout bij zoeken.");
    } finally {
      setSearching(false);
    }
  }, [q, plaats]);

  const onEnrich = useCallback(async () => {
    if (!selected?.kvkNummer) return;
    setEnriching(true);
    setEnrichError(null);
    setDbNote(null);
    setEnriched(null);
    try {
      const res = await fetch("/api/leads/enrich", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kvkNummer: selected.kvkNummer,
          manualWebsiteUrl: manualUrl.trim() || null,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: EnrichedLeadPayload & { savedRow?: unknown };
        error?: unknown;
      };
      if (!res.ok || !json.ok || !json.data) {
        setEnrichError(
          typeof json.error === "string" ? json.error : JSON.stringify(json.error ?? res.status),
        );
        return;
      }
      const { savedRow, ...rest } = json.data;
      setEnriched(rest as EnrichedLeadPayload);
      setDbNote(savedRow ? "Opgeslagen in kvk_enriched_leads." : "Niet opgeslagen (database of migratie).");
    } catch {
      setEnrichError("Netwerkfout bij verrijken.");
    } finally {
      setEnriching(false);
    }
  }, [selected, manualUrl]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-neutral-900">Zoeken in KVK Handelsregister</h2>
        <p className="mt-1 text-[12px] text-neutral-500">
          Alleen server-side calls; API-key staat nooit in de browser.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="text-[10px] font-medium uppercase text-neutral-500">Bedrijfsnaam</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
              placeholder="Bijv. bakkerij"
            />
          </div>
          <div className="w-full sm:w-40">
            <label className="text-[10px] font-medium uppercase text-neutral-500">Plaats (optioneel)</label>
            <input
              value={plaats}
              onChange={(e) => setPlaats(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
              placeholder="Utrecht"
            />
          </div>
          <button
            type="button"
            disabled={searching || q.trim().length < 2}
            onClick={() => void onSearch()}
            className="sales-os-glass-primary-btn inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Zoeken
          </button>
        </div>
        {searchError ? <p className="mt-3 text-sm text-rose-600">{searchError}</p> : null}
      </section>

      {results.length > 0 ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Resultaten</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {results.map((r) => (
              <li key={`${r.kvkNummer}-${r.type ?? ""}-${r.plaats ?? ""}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(r);
                    setEnriched(null);
                    setEnrichError(null);
                  }}
                  className={`flex w-full flex-col items-start gap-0.5 py-3 text-left sm:flex-row sm:justify-between ${
                    selected?.kvkNummer === r.kvkNummer ? "bg-neutral-100" : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-medium text-neutral-900">{r.naam || r.handelsnaam || "—"}</span>
                  <span className="text-[12px] text-neutral-500">
                    KVK {r.kvkNummer}
                    {r.plaats ? ` · ${r.plaats}` : ""}
                    {r.type ? ` · ${r.type}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selected ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Selectie</h2>
          <p className="mt-1 text-sm text-neutral-700">
            <strong>{selected.naam}</strong> — KVK {selected.kvkNummer}
            {selected.plaats ? ` · ${selected.plaats}` : ""}
          </p>
          <div className="mt-4">
            <label className="text-[10px] font-medium uppercase text-neutral-500">
              Handmatige website-URL (optioneel)
            </label>
            <input
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10"
              placeholder="https://…"
            />
          </div>
          <button
            type="button"
            disabled={enriching}
            onClick={() => void onEnrich()}
            className="sales-os-glass-primary-btn mt-4 inline-flex items-center gap-2 rounded-md border border-transparent bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {enriching ? <Loader2 className="size-4 animate-spin" /> : null}
            Verrijk lead
          </button>
          {enrichError ? <p className="mt-3 text-sm text-rose-600">{enrichError}</p> : null}
          {dbNote ? <p className="mt-2 text-[12px] text-neutral-500">{dbNote}</p> : null}
        </section>
      ) : null}

      {enriched ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-neutral-900">Enrichment</h2>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="text-neutral-500">Bedrijf: </span>
              <span className="font-medium text-neutral-900">{enriched.profile.naam}</span>
            </p>
            <p>
              <span className="text-neutral-500">KVK: </span>
              {enriched.profile.kvkNummer}
            </p>
            <p>
              <span className="text-neutral-500">Plaats: </span>
              {enriched.profile.plaats ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Website-status (sales): </span>
              <span className="font-medium text-neutral-900">
                {STATUS_LABEL[enriched.opportunity.websiteStatus] ?? enriched.opportunity.websiteStatus}
              </span>
            </p>
            <p>
              <span className="text-neutral-500">Gedetecteerde URL: </span>
              {enriched.detection.finalUrl ?? enriched.detection.detectedUrl ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Bron: </span>
              {enriched.detection.detectionSource} · outcome: {enriched.detection.outcome} · HTTP{" "}
              {enriched.detection.httpStatus ?? "—"}
            </p>
            <p>
              <span className="text-neutral-500">Kwaliteitsscore: </span>
              {enriched.quality != null ? (
                <>
                  <span className="font-semibold tabular-nums">{enriched.quality.score}</span> / 100 (
                  {enriched.quality.verdict})
                </>
              ) : (
                "— (geen analyse)"
              )}
            </p>
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
              <p className="text-[11px] font-semibold uppercase text-neutral-500">Call angle</p>
              <p className="mt-1 text-neutral-800">{enriched.opportunity.callAngle}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-neutral-500">Reason codes</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {enriched.opportunity.reasonCodes.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
