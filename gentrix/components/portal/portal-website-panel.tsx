"use client";

import { useCallback, useState } from "react";
import { Globe } from "lucide-react";

type Props = {
  slug: string;
  customDomain: string | null;
  domainVerified: boolean;
  domainDnsTarget: string | null;
};

export function PortalWebsitePanel({
  customDomain,
  domainVerified,
  domainDnsTarget,
}: Props) {
  const [domainInput, setDomainInput] = useState("");
  const [domainHint, setDomainHint] = useState<string | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);

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

  return (
    <div className="space-y-8">
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
