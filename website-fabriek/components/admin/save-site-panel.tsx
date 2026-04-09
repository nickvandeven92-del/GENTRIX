"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Database, Loader2, Rocket, Save } from "lucide-react";
import { STUDIO_GENERATION_PACKAGE } from "@/lib/ai/generation-packages";
import {
  generatedTailwindPageToSectionsPayload,
  type GeneratedTailwindPage,
} from "@/lib/ai/tailwind-sections-schema";
import { isValidSubfolderSlug, slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

type SaveSitePanelProps = {
  /** Gegenereerde Tailwind-pagina (wordt naar `tailwind_sections` genormaliseerd). */
  page: GeneratedTailwindPage;
  defaultName: string;
  defaultDescription: string;
  /** Uit URL bij bewerken; anders leeg tot de gebruiker een slug invult of uit de klantnaam volgt. */
  defaultSubfolderSlug?: string;
  /** Standaard publicatiestatus bij eerste tonen van het paneel. */
  defaultPublishStatus?: "draft" | "active";
};

export function SaveSitePanel({
  page,
  defaultName,
  defaultDescription,
  defaultSubfolderSlug,
  defaultPublishStatus,
}: SaveSitePanelProps) {
  function initialSlug(): string {
    const fromUrl = defaultSubfolderSlug?.trim();
    if (fromUrl) return fromUrl;
    const fromName = slugify(defaultName);
    return fromName.length >= 2 ? fromName : "";
  }

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [subfolderSlug, setSubfolderSlug] = useState(initialSlug);
  const [status, setStatus] = useState<"draft" | "active">(() => defaultPublishStatus ?? "draft");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [publishNote, setPublishNote] = useState<string | null>(null);

  useEffect(() => {
    setName(defaultName);
    setDescription(defaultDescription);
    setStatus(defaultPublishStatus ?? "draft");
  }, [defaultName, defaultDescription, defaultPublishStatus]);

  useEffect(() => {
    const fromUrl = defaultSubfolderSlug?.trim();
    if (fromUrl) setSubfolderSlug(fromUrl);
  }, [defaultSubfolderSlug]);

  const resolvedSlug = subfolderSlug.trim() || slugify(name);
  const slugOk = isValidSubfolderSlug(resolvedSlug);

  async function save() {
    setError(null);
    setSavedUrl(null);
    setPublishNote(null);
    if (!slugOk) {
      setError(
        "Vul een geldige URL-slug in (2–64 tekens: kleine letters, cijfers, koppeltekens), of een klantnaam die daarnaar leidt.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          subfolder_slug: resolvedSlug,
          site_data_json: generatedTailwindPageToSectionsPayload(page),
          status,
          generation_package: STUDIO_GENERATION_PACKAGE,
          snapshot_source: "generator",
        }),
      });
      const payload = (await res.json()) as
        | { ok: true; data: { subfolder_slug: string; status: string } }
        | { ok: false; error: string };

      if (!res.ok || !payload.ok) {
        setError(!payload.ok ? payload.error : "Opslaan mislukt.");
        return;
      }

      if (typeof window !== "undefined") {
        const path = `/site/${payload.data.subfolder_slug}`;
        setSavedUrl(`${window.location.origin}${path}`);
        setPublishNote(null);
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
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")}>
            <option value="draft">Concept — /site/… geblokkeerd</option>
            <option value="active">Actief — /site/… toegestaan (inhoud = apart publiceren)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Live <strong>inhoud</strong> zet je met <strong>Publiceren naar live</strong> na opslaan — niet via deze dropdown.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={loading || !name.trim() || !slugOk}
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

      {savedUrl && (
        <div className="mt-3 space-y-2">
          <p className="flex items-start gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Concept opgeslagen.{" "}
              {status === "active" ? (
                <>
                  Publieke URL (na publiceren + actieve status):{" "}
                  <a href={savedUrl} className="font-medium underline">
                    {savedUrl}
                  </a>
                </>
              ) : (
                "Zet klantstatus op Actief voor /site/…; daarna nog ‘Publiceren naar live’ voor inhoud."
              )}
            </span>
          </p>
          <button
            type="button"
            disabled={publishing || loading}
            onClick={async () => {
              setPublishing(true);
              setPublishNote(null);
              setError(null);
              try {
                const res = await fetch(`/api/clients/${encodeURIComponent(resolvedSlug)}/publish`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                });
                const json = (await res.json()) as { ok: boolean; error?: string };
                if (!res.ok || !json.ok) {
                  setError(json.error ?? "Publiceren mislukt.");
                  return;
                }
                setPublishNote("Live-pointer bijgewerkt naar het huidige concept.");
              } catch {
                setError("Netwerkfout bij publiceren.");
              } finally {
                setPublishing(false);
              }
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm",
              "hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            {publishing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Rocket className="size-4" aria-hidden />}
            {publishing ? "Publiceren…" : "Publiceren naar live"}
          </button>
          {publishNote && <p className="text-sm text-emerald-700">{publishNote}</p>}
        </div>
      )}
    </div>
  );
}
