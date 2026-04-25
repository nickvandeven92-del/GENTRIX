"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, Save } from "lucide-react";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import type { DesignGenerationContract } from "@/lib/ai/design-generation-contract";
import {
  generatedTailwindPageToSectionsPayload,
  type GeneratedTailwindPage,
} from "@/lib/ai/tailwind-sections-schema";
import { slugifyClientNameForSubfolder } from "@/lib/studio/client-name-for-slug";
import { deriveStudioBusinessNameFromBriefing } from "@/lib/studio/derive-studio-business-name";
import { isStudioUndecidedBrandName } from "@/lib/studio/studio-brand-sentinel";
import { isValidSubfolderSlug, slugify, STUDIO_HOMEPAGE_SUBFOLDER_SLUG } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { describeTailwindMarketingNavPayloadIssues } from "@/lib/site/tailwind-marketing-nav-consistency";

/**
 * Alleen klant-/bedrijfsnaam gebruiken voor slug — nooit de volledige briefing (voorkomt megaslugs).
 * Zonder naam: kort afgeleid uit de briefing via dezelfde heuristiek als de generator.
 */
function textBasisForSubfolderSlug(
  generatorMode: boolean,
  name: string,
  description: string,
): string {
  const n = name.trim();
  const d = description.trim();
  if (generatorMode) {
    if (n) return n;
    const fromBrief = deriveStudioBusinessNameFromBriefing(d);
    if (fromBrief && !isStudioUndecidedBrandName(fromBrief)) return fromBrief;
    return d;
  }
  return n || d;
}

type SaveSitePanelProps = {
  /** Gegenereerde Tailwind-pagina (wordt naar `tailwind_sections` genormaliseerd). */
  page: GeneratedTailwindPage;
  /** Optioneel: voor `siteIr` in canonieke project-snapshot (branche/blueprint). */
  siteIrHints?: {
    detectedIndustryId?: string;
    blueprintId?: string;
  };
  defaultName: string;
  defaultDescription: string;
  /** Uit URL bij bewerken; anders leeg tot de gebruiker een slug invult of uit de klantnaam volgt. */
  defaultSubfolderSlug?: string;
  /** Standaard publicatiestatus bij eerste tonen van het paneel. */
  defaultPublishStatus?: "draft" | "active";
  /**
   * Site studio: sla altijd op als concept; live op /site/… volgt na betaling (status Actief).
   * Verbergt de status-dropdown.
   */
  generatorMode?: boolean;
  /** Na geslaagde POST (concept bijgewerkt). */
  onSaved?: () => void;
  /**
   * Denklijn-contract: wordt als `design_contract_json` meegePOST en in `project_snapshot_v1.designContract` gezet
   * (niet in `tailwind_sections`).
   */
  designContract?: DesignGenerationContract | null;
};

export function SaveSitePanel({
  page,
  siteIrHints,
  defaultName,
  defaultDescription,
  defaultSubfolderSlug,
  defaultPublishStatus,
  generatorMode = false,
  onSaved,
  designContract = null,
}: SaveSitePanelProps) {
  function initialSlug(): string {
    const fromUrl = defaultSubfolderSlug?.trim();
    if (fromUrl) return fromUrl;
    const basis = textBasisForSubfolderSlug(generatorMode, defaultName, defaultDescription);
    const fromName = slugifyClientNameForSubfolder(basis);
    return fromName.length >= 2 ? fromName : "";
  }

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [subfolderSlug, setSubfolderSlug] = useState(initialSlug);
  const [status, setStatus] = useState<"draft" | "active">(() => defaultPublishStatus ?? "draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  /** Publieke concept-preview (token); alleen bij concept-status. */
  const [savedPreviewUrl, setSavedPreviewUrl] = useState<string | null>(null);
  /** Altijd tonen na geslaagde POST (ook zonder preview-token of live-link). */
  const [lastSaveMessage, setLastSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(defaultName);
    setDescription(defaultDescription);
    setStatus(defaultPublishStatus ?? "draft");
  }, [defaultName, defaultDescription, defaultPublishStatus]);

  useEffect(() => {
    const fromUrl = defaultSubfolderSlug?.trim();
    if (fromUrl) setSubfolderSlug(fromUrl);
  }, [defaultSubfolderSlug]);

  const slugDeriveBasis = textBasisForSubfolderSlug(generatorMode, name, description);
  const resolvedSlug = subfolderSlug.trim() || slugifyClientNameForSubfolder(slugDeriveBasis);
  const slugOk = isValidSubfolderSlug(resolvedSlug);
  const marketingNavPayloadIssue = describeTailwindMarketingNavPayloadIssues({
    sections: page.sections,
    contactSections: page.contactSections,
    marketingPages: page.marketingPages,
  });

  async function save() {
    setError(null);
    setSavedUrl(null);
    setSavedPreviewUrl(null);
    setLastSaveMessage(null);
    if (!slugOk) {
      setError(
        "Vul een geldige URL-slug in (2–64 tekens: kleine letters, cijfers, koppeltekens), of een klantnaam die daarnaar leidt.",
      );
      return;
    }
    if (marketingNavPayloadIssue) {
      setError(marketingNavPayloadIssue);
      return;
    }
    setLoading(true);
    try {
      const effectiveStatus = generatorMode
        ? resolvedSlug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG
          ? "active"
          : "draft"
        : status;
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          subfolder_slug: resolvedSlug,
          site_data_json: generatedTailwindPageToSectionsPayload(page),
          status: effectiveStatus,
          generation_package: STUDIO_GENERATION_PACKAGE,
          snapshot_source: "generator",
          ...(designContract != null ? { design_contract_json: designContract } : {}),
          ...(siteIrHints?.detectedIndustryId || siteIrHints?.blueprintId
            ? {
                site_ir_hints: {
                  ...(siteIrHints.detectedIndustryId
                    ? { detected_industry_id: siteIrHints.detectedIndustryId }
                    : {}),
                  ...(siteIrHints.blueprintId ? { blueprint_id: siteIrHints.blueprintId } : {}),
                },
              }
            : {}),
        }),
      });
      const payload = (await res.json()) as
        | {
            ok: true;
            data: {
              subfolder_slug: string;
              status: string;
              preview_url?: string | null;
            };
          }
        | { ok: false; error: string };

      if (!res.ok || !payload.ok) {
        setError(!payload.ok ? payload.error : "Opslaan mislukt.");
        return;
      }

      setLastSaveMessage("Opgeslagen / bijgewerkt.");
      onSaved?.();
      if (typeof window !== "undefined") {
        if (payload.data.preview_url) {
          setSavedPreviewUrl(payload.data.preview_url);
        } else if (payload.data.status === "active") {
          setSavedUrl(`${window.location.origin}/site/${encodeURIComponent(payload.data.subfolder_slug)}`);
        }
      }
    } catch {
      setError("Netwerkfout.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

  return (
    <div className="sales-os-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Database className="size-5 text-indigo-600" aria-hidden />
        <h3 className="font-semibold text-slate-900">Opslaan in Supabase</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Opgeslagen als{" "}
        <code className="rounded bg-slate-100 px-1 text-xs text-slate-800">tailwind_sections</code>. Publieke site rendert
        zoals in de preview (HTML + Tailwind). Vereist{" "}
        <code className="rounded bg-slate-100 px-1 text-xs text-slate-800">SUPABASE_SERVICE_ROLE_KEY</code>.
      </p>

      {marketingNavPayloadIssue && (
        <div
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          <strong>Opslaan geblokkeerd:</strong> {marketingNavPayloadIssue}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">Klantnaam</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-600">Omschrijving (optioneel)</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">URL-slug (uniek)</label>
          <input
            className={cn(inputClass, "font-mono")}
            value={subfolderSlug}
            onChange={(e) => setSubfolderSlug(slugify(e.target.value))}
            placeholder="bijv. acme-of-home"
          />
          <p className="mt-1 text-xs text-slate-500">
            Leeg laten mag: dan wordt de slug afgeleid van de klantnaam. Homepage op <code className="font-mono">/</code>: slug{" "}
            <code className="font-mono">home</code>.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Klantstatus (commercieel)</label>
          {generatorMode ? (
            resolvedSlug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG ? (
              <div className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                <strong>Homepage</strong> — slug <code className="font-mono">{STUDIO_HOMEPAGE_SUBFOLDER_SLUG}</code>{" "}
                wordt opgeslagen als <strong>Actief</strong> en direct live gezet op{" "}
                <code className="font-mono">/site/{STUDIO_HOMEPAGE_SUBFOLDER_SLUG}</code> (eigen site; geen
                concept-token of betalingscheck).
              </div>
            ) : (
              <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                <strong>Concept</strong> — opslaan maakt een publieke preview-URL (met token) voor jou en de klant. De
                definitieve URL op <code className="font-mono">/site/…</code> wordt pas vrij na betaling (status Actief).
              </div>
            )
          ) : (
            <>
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")}>
                <option value="draft">Concept — /site/… geblokkeerd; gebruik concept-preview voor de klant</option>
                <option value="active">Actief — /site/… toegestaan voor bezoekers</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Concept staat op je laatste opslag. Live-inhoud voor bezoekers stem je af via site-studio (tab Bewerken)
                of snapshots in het dossier.
              </p>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={loading || !name.trim() || !slugOk || Boolean(marketingNavPayloadIssue)}
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm",
          "hover:bg-[#5558e8] disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Save className="size-4" aria-hidden />
        )}
        {loading ? "Opslaan…" : "Opslaan / bijwerken"}
      </button>

      {error && (
        <div className="mt-3 space-y-2" role="alert">
          <p className="text-sm text-red-600">{error}</p>
          {/clients_generation_package_check|generation_package/i.test(error) && (
            <p className="text-xs leading-relaxed text-slate-600">
              De database verwacht nog oude pakketwaarden of een andere check. Voer in de Supabase SQL Editor het bestand{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">
                supabase/migrations/20260403180000_single_studio_generation_package.sql
              </code>{" "}
              uit (zet alles op <code className="font-mono">studio</code> en past de constraint aan). Daarna opnieuw
              opslaan.
            </p>
          )}
          {/clients.*name|name.*column|schema cache/i.test(error) && (
            <p className="text-xs leading-relaxed text-slate-600">
              Je Supabase-tabel wijkt waarschijnlijk af van de app (bijv. <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">business_name</code> i.p.v.{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">name</code>, of{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">slug</code> i.p.v.{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">subfolder_slug</code>). Voer in de SQL
              Editor uit:{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">
                supabase/migrations/20260329140000_align_custom_clients_to_app_schema.sql
              </code>
              . Alleen ontbrekende <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">name</code>:{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-slate-800">
                20260329103000_clients_ensure_name_column.sql
              </code>
              . Daarna: API → <strong>Reload schema</strong>.
            </p>
          )}
        </div>
      )}

      {lastSaveMessage && (
        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{lastSaveMessage}</span>
          </p>
          {(savedPreviewUrl || savedUrl) && (
            <p className="text-sm text-emerald-800">
              {savedPreviewUrl ? (
                <>
                  <strong>Deel met de klant</strong> (concept, niet geïndexeerd):{" "}
                  <a href={savedPreviewUrl} className="font-medium break-all underline">
                    {savedPreviewUrl}
                  </a>
                </>
              ) : savedUrl ? (
                <>
                  {resolvedSlug === STUDIO_HOMEPAGE_SUBFOLDER_SLUG ? (
                    <>
                      Publieke homepage:{" "}
                      <a href={savedUrl} className="font-medium underline">
                        {savedUrl}
                      </a>{" "}
                      (inhoud is bij opslaan al live gezet).
                    </>
                  ) : (
                    <>
                      Publieke live-URL (zichtbaar als de klant <strong>Actief</strong> is):{" "}
                      <a href={savedUrl} className="font-medium underline">
                        {savedUrl}
                      </a>
                    </>
                  )}
                </>
              ) : null}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
