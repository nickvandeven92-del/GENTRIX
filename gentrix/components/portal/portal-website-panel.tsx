"use client";

import { useCallback, useState } from "react";
import { ExternalLink, Globe, Loader2, Rocket } from "lucide-react";

type Props = {
  slug: string;
  draftSnapshotId: string | null;
  publishedSnapshotId: string | null;
  customDomain: string | null;
  domainVerified: boolean;
  domainDnsTarget: string | null;
  publicSiteAbsoluteUrl: string;
};

export function PortalWebsitePanel({
  slug,
  draftSnapshotId,
  publishedSnapshotId,
  customDomain,
  domainVerified,
  domainDnsTarget,
  publicSiteAbsoluteUrl,
}: Props) {
  const enc = encodeURIComponent(decodeURIComponent(slug));
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [publishErr, setPublishErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [domainInput, setDomainInput] = useState("");
  const [domainHint, setDomainHint] = useState<string | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);

  const onPublish = useCallback(async () => {
    setBusy(true);
    setPublishErr(null);
    setPublishMsg(null);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; data?: { visibility_hint?: string | null } };
      if (!res.ok || !json.ok) {
        setPublishErr(json.error ?? "Publiceren mislukt.");
        return;
      }
      setPublishMsg(
        json.data?.visibility_hint ??
          "Live-inhoud bijgewerkt. Bezoekers zien de wijzigingen op je publieke site (cache kan even meelopen).",
      );
    } catch {
      setPublishErr("Netwerkfout bij publiceren.");
    } finally {
      setBusy(false);
    }
  }, [enc]);

  const onCheckDomain = useCallback(async () => {
    const q = domainInput.trim();
    if (!q) {
      setDomainHint("Vul een domein in (bijv. mijnbedrijf.nl).");
      return;
    }
    setDomainBusy(true);
    setDomainHint(null);
    try {
      const u = new URL("/api/public/domain-check", window.location.origin);
      u.searchParams.set("domain", q);
      const res = await fetch(u.toString());
      const json = (await res.json()) as { hint?: string; detail?: string };
      if (json.hint === "available") {
        setDomainHint(`Waarschijnlijk vrij: ${json.detail ?? ""}`.trim());
      } else if (json.hint === "taken") {
        setDomainHint(`Waarschijnlijk bezet: ${json.detail ?? ""}`.trim());
      } else {
        setDomainHint(json.detail ?? "Geen duidelijk antwoord — vraag je studio om hulp.");
      }
    } catch {
      setDomainHint("Check tijdelijk niet bereikbaar.");
    } finally {
      setDomainBusy(false);
    }
  }, [domainInput]);

  const draftOutOfSync =
    draftSnapshotId && publishedSnapshotId && draftSnapshotId !== publishedSnapshotId;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Live publiceren</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Zet de huidige conceptversie voor bezoekers live. Layout en structuur blijven zoals door de studio
          opgezet; dit werkt het beste als je alleen teksten en beelden in overleg aanpast.
        </p>
        {!draftSnapshotId ? (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">Er is nog geen concept-snapshot om te publiceren.</p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onPublish}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
              Zet huidige versie live
            </button>
            <a
              href={publicSiteAbsoluteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="size-4" aria-hidden />
              Open publieke site
            </a>
          </div>
        )}
        {draftOutOfSync ? (
          <p className="mt-3 text-xs text-zinc-500">
            Concept en live wijken van elkaar af — na publiceren zijn ze weer gelijk.
          </p>
        ) : null}
        {publishErr ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{publishErr}</p> : null}
        {publishMsg ? <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-200">{publishMsg}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Eigen domein</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Je studio koppelt je domein aan deze site. Hieronder zie je de huidige status; DNS-wijzigingen kunnen
          enkele uren duren.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">Domein</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{customDomain?.trim() || "— nog niet ingesteld —"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-zinc-700 dark:text-zinc-300">DNS gecontroleerd</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{domainVerified ? "ja" : "nee"}</dd>
          </div>
          {domainDnsTarget?.trim() ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-medium text-zinc-700 dark:text-zinc-300">Doel (hint)</dt>
              <dd>
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{domainDnsTarget}</code>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">
          <Globe className="size-4 shrink-0" aria-hidden />
          Domein-check (.nl / .com / .net)
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Snelle indicatie of een naam waarschijnlijk vrij is (via RDAP). Geen koopgarantie — registratie loopt via
          je studio of registrar.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="voorbeeld.nl"
            className="min-w-[12rem] flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="button"
            disabled={domainBusy}
            onClick={onCheckDomain}
            className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {domainBusy ? "Bezig…" : "Check"}
          </button>
        </div>
        {domainHint ? <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{domainHint}</p> : null}
      </section>
    </div>
  );
}
