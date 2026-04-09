import type { Metadata } from "next";
import Link from "next/link";
import {
  getSampleUserPromptForDashboard,
  getUnifiedPackagePromptSnippetForDashboard,
  PROMPT_DASHBOARD_SAMPLE_META,
  WEBSITE_PROMPT_SOURCE_FILES,
} from "@/lib/ai/website-generation-prompt-dashboard";
import { KNOWLEDGE_JOURNAL_CATEGORY } from "@/lib/ai/knowledge-categories";
import { listAiKnowledgeForAdmin } from "@/lib/data/ai-knowledge";

export const metadata: Metadata = {
  title: "Site-generator prompt",
};

export default async function AdminPromptPage() {
  const knowledgeRows = await listAiKnowledgeForAdmin();
  const activeKnowledge = knowledgeRows.filter(
    (r) => r.is_active && r.category !== KNOWLEDGE_JOURNAL_CATEGORY,
  );
  const snippet = getUnifiedPackagePromptSnippetForDashboard();

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Site-generator prompt
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Deze pagina is bedoeld voor <strong>ontwikkelaars</strong> die de bron van de generator willen inzien. Voor
          gewone uitleg over het systeem:{" "}
          <Link href="/admin/ops/werkwijze" className="font-medium text-violet-700 underline dark:text-violet-400">
            veelgestelde vragen
          </Link>
          . Hier zie je <strong>waar</strong> de instructies vandaan komen en een <strong>voorbeeld</strong> van het
          volledige user-bericht. De echte run in{" "}
          <Link href="/admin/ops/studio" className="font-medium text-blue-700 underline dark:text-blue-400">
            Site studio
          </Link>{" "}
          gebruikt jouw ingevulde naam, omschrijving en recente klantnamen (voor variatie). Er is één product: alle
          eerdere pakket-opties zitten in hetzelfde promptblok. Aanpassingen in de vaste teksten doe je in de
          bronbestanden in Cursor.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Broncode (overzicht)</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {WEBSITE_PROMPT_SOURCE_FILES.map((f) => (
            <li
              key={f.path}
              className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <code className="text-xs font-medium text-blue-800 dark:text-blue-300">{f.path}</code>
              <p className="mt-1 font-medium text-zinc-800 dark:text-zinc-200">{f.label}</p>
              <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">{f.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/25">
        <h2 className="text-sm font-semibold text-blue-950 dark:text-blue-100">System-bericht uit AI-kennis</h2>
        <p className="mt-2 text-sm text-blue-950/90 dark:text-blue-100/90">
          Actieve items (behalve activiteitenlog): de <strong>tekst</strong> gaat als <strong>system</strong> mee;
          eventuele <strong>referentie-screenshots</strong> uit de kennisbank worden in hetzelfde Claude-verzoek als
          afbeeldingen in het <strong>user</strong>-bericht vóór de eigenlijke opdracht gezet. Beheer onder{" "}
          <Link href="/admin/knowledge" className="font-medium underline">
            AI-kennis
          </Link>
          .
        </p>
        {activeKnowledge.length === 0 ? (
          <p className="mt-3 text-sm text-blue-900/80 dark:text-blue-200/80">Geen actieve kennisregels.</p>
        ) : (
          <ul className="mt-3 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-sm text-blue-950/90 dark:text-blue-100/90">
            {activeKnowledge.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.title}</span>
                <span className="text-blue-900/70 dark:text-blue-200/70"> ({r.category})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Studio-blok (in user-prompt §0B)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Dit fragment wordt altijd toegevoegd: marketing, optioneel portaal-mock, maatwerk uit briefing.
        </p>
        <details
          className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20"
          open
        >
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {snippet.label}
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            {snippet.body}
          </pre>
        </details>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Volledig user-bericht (voorbeeld)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Vaste demo-invoer: <strong>{PROMPT_DASHBOARD_SAMPLE_META.businessName}</strong>, twee fictieve recente klanten
          voor het uniekheids-protocol.
        </p>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/30">
          <pre className="max-h-[min(70vh,520px)] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
            {getSampleUserPromptForDashboard()}
          </pre>
        </div>
      </section>
    </div>
  );
}
