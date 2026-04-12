"use client";



import Link from "next/link";

import { useRouter } from "next/navigation";

import { useEffect, useMemo, useState } from "react";

import type { SalesDealRow } from "@/lib/data/sales-deals";

import { DEAL_STAGE_LABELS, SALES_DEAL_STAGES, type SalesDealStage } from "@/lib/sales-os/deal-stages";

import { parseDealStepLog } from "@/lib/sales-os/deal-step-log";

import { formatEURFromCents } from "@/lib/sales-os/format-money";

import { Mail, Phone, Receipt, ScrollText, Sparkles, Trophy, XCircle } from "lucide-react";

function formatNlDatetime(iso: string | null): string {

  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString("nl-NL", {

    day: "2-digit",

    month: "2-digit",

    year: "numeric",

    hour: "2-digit",

    minute: "2-digit",

  });

}



export function DealDetailClient({ deal }: { deal: SalesDealRow }) {

  const router = useRouter();

  const [busy, setBusy] = useState(false);

  const [nextStep, setNextStep] = useState(deal.next_step ?? "");

  const [due, setDue] = useState(

    deal.next_step_due_at ? deal.next_step_due_at.slice(0, 16) : "",

  );

  const [lostReason, setLostReason] = useState(deal.lost_reason ?? "");

  const [saveError, setSaveError] = useState<string | null>(null);



  useEffect(() => {

    setNextStep(deal.next_step ?? "");

    setDue(deal.next_step_due_at ? deal.next_step_due_at.slice(0, 16) : "");

    setLostReason(deal.lost_reason ?? "");

    setSaveError(null);

  }, [deal.updated_at, deal.id, deal.next_step, deal.next_step_due_at, deal.lost_reason]);



  const stepLog = useMemo(() => parseDealStepLog(deal.next_step_log), [deal.next_step_log]);

  const stepLogNewestFirst = useMemo(() => [...stepLog].reverse(), [stepLog]);



  async function patch(body: Record<string, unknown>) {

    setBusy(true);

    try {

      const res = await fetch(`/api/admin/sales-os/deals/${deal.id}`, {

        method: "PATCH",

        credentials: "include",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(body),

      });

      const j = (await res.json()) as { ok?: boolean; error?: string };

      if (!j.ok) {

        setSaveError(j.error ?? "Opslaan mislukt.");

        return;

      }

      setSaveError(null);

      router.refresh();

    } finally {

      setBusy(false);

    }

  }



  function saveFields() {

    setSaveError(null);

    const msg = nextStep.trim();

    if (!msg) {

      setSaveError("Vul een volgende stap in (verplicht).");

      return;

    }

    if (!due.trim()) {

      setSaveError("Kies een opvolgdatum (verplicht; zichtbaar op het dashboard / in de pijplijn).");

      return;

    }

    const dueDate = new Date(due);

    if (Number.isNaN(dueDate.getTime())) {

      setSaveError("Ongeldige opvolgdatum.");

      return;

    }

    void patch({

      planning_commit: { message: msg, due_at: dueDate.toISOString() },

    });

  }



  const fieldInput =

    "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-950 focus:outline-none focus:ring-1 focus:ring-neutral-950/10";

  const invoiceHref = deal.client_id

    ? `/admin/invoices/new?client_id=${encodeURIComponent(deal.client_id)}&deal_id=${encodeURIComponent(deal.id)}&amount=${encodeURIComponent((deal.value_cents / 100).toFixed(2))}`

    : null;

  const quoteHref = deal.client_id

    ? `/admin/quotes/new?client_id=${encodeURIComponent(deal.client_id)}&deal_id=${encodeURIComponent(deal.id)}&amount=${encodeURIComponent((deal.value_cents / 100).toFixed(2))}`

    : null;



  return (

    <div className="mx-auto max-w-[1200px]">

      <Link

        href="/admin/ops/deals"

        className="mb-6 inline-flex text-[11px] font-medium text-neutral-500 hover:text-neutral-900"

      >

        ← Alle deals

      </Link>



      <div className="grid gap-8 lg:grid-cols-[1fr_280px]">

        <div className="space-y-6">

          <header>

            <h1 className="text-xl font-semibold text-neutral-900">{deal.company_name}</h1>

            <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">

              {formatEURFromCents(deal.value_cents)}

            </p>

            <div className="mt-3 flex flex-wrap gap-2">

              {deal.at_risk ? (

                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">

                  Risico

                </span>

              ) : null}

              <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600">

                {DEAL_STAGE_LABELS[deal.stage]}

              </span>

            </div>

          </header>



          <section className="sales-os-glass-panel space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-950/50">

            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Fase &amp; planning</h2>

            <label className="block text-[10px] uppercase text-neutral-600">Fase</label>

            <select

              disabled={busy}

              value={deal.stage}

              onChange={(e) => void patch({ stage: e.target.value as SalesDealStage })}

              className={`${fieldInput} max-w-xs`}

            >

              {SALES_DEAL_STAGES.map((s) => (

                <option key={s} value={s}>

                  {DEAL_STAGE_LABELS[s]}

                </option>

              ))}

            </select>

            <label className="mt-3 block text-[10px] uppercase text-neutral-600">

              Volgende stap <span className="text-rose-600">*</span>

            </label>

            <textarea

              value={nextStep}

              onChange={(e) => setNextStep(e.target.value)}

              rows={3}

              placeholder="Wat ga je doen? (verplicht om op te slaan)"

              className={fieldInput}

            />

            <label className="mt-2 block text-[10px] uppercase text-neutral-600">

              Opvolgdatum <span className="text-rose-600">*</span>

            </label>

            <p className="text-[11px] text-neutral-500">

              Deze datum wordt gebruikt op het overzicht en in de pijplijn (deadlines in de komende tijd).

            </p>

            <input

              type="datetime-local"

              value={due}

              onChange={(e) => setDue(e.target.value)}

              className={fieldInput}

            />

            <div className="mt-2 rounded-md border border-neutral-100 bg-neutral-50/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Eigenaar</p>
              <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-zinc-100">
                {deal.owner_label?.trim() ? deal.owner_label : "—"}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-zinc-400">
                Automatisch: laatste wijziging wordt toegeschreven aan de ingelogde gebruiker (e-mail).
              </p>
            </div>

            {saveError ? (

              <p className="text-sm text-rose-600" role="alert">

                {saveError}

              </p>

            ) : null}

            <button

              type="button"

              disabled={busy}

              onClick={() => saveFields()}

              className="sales-os-glass-primary-btn mt-3 rounded-md border border-transparent bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"

            >

              Velden opslaan

            </button>



            {stepLog.length > 0 ? (

              <details className="sales-os-card-glass mt-4 rounded-md border border-neutral-200/80 bg-white/60 dark:border-zinc-600/50 dark:bg-zinc-950/30">

                <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-neutral-700">

                  Eerdere stappen ({stepLog.length}) — klik om te openen

                </summary>

                <ul className="max-h-64 space-y-2 overflow-y-auto border-t border-neutral-100 px-3 py-2 text-[12px] text-neutral-700">

                  {stepLogNewestFirst.map((entry, i) => (

                    <li

                      key={`${entry.logged_at}-${i}`}

                      className="rounded border border-neutral-100 bg-white px-2 py-1.5"

                    >

                      <p className="whitespace-pre-wrap text-neutral-900">{entry.message}</p>

                      <p className="mt-1 text-[10px] text-neutral-500">

                        Opvolg: {formatNlDatetime(entry.due_at)} · vastgelegd {formatNlDatetime(entry.logged_at)}

                        {entry.logged_by_label ? ` · door ${entry.logged_by_label}` : ""}

                      </p>

                    </li>

                  ))}

                </ul>

              </details>

            ) : null}

          </section>



          <section className="sales-os-glass-panel rounded-lg border border-neutral-200 bg-white p-4 dark:border-zinc-700/80 dark:bg-zinc-950/50">

            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Als verloren markeren</h2>

            <textarea

              value={lostReason}

              onChange={(e) => setLostReason(e.target.value)}

              placeholder="Reden"

              rows={2}

              className={`${fieldInput} mt-2`}

            />

            <button

              type="button"

              disabled={busy}

              onClick={() => void patch({ stage: "lost", lost_reason: lostReason.trim() || null })}

              className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100"

            >

              Zet op verloren

            </button>

          </section>

        </div>



        <aside className="sales-os-card-glass h-fit space-y-2 rounded-lg border border-neutral-200/80 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-600/50 dark:bg-zinc-950/40 lg:sticky lg:top-24">

          <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Acties</p>

          <button

            type="button"

            disabled={busy}

            onClick={() => void patch({ stage: "won" })}

            className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 hover:border-neutral-300 hover:bg-white"

          >

            <Trophy className="size-4 text-amber-600" />

            Markeer als gewonnen

          </button>

          {invoiceHref ? (

            <Link

              href={invoiceHref}

              className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 hover:border-neutral-300 hover:bg-white"

            >

              <Receipt className="size-4 text-neutral-700" />

              Maak factuur

            </Link>

          ) : (

            <p className="rounded-md border border-dashed border-neutral-200 px-3 py-2 text-[11px] text-neutral-500">

              Maak factuur: koppel eerst een klant aan deze deal.

            </p>

          )}

          {quoteHref ? (

            <Link

              href={quoteHref}

              className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 hover:border-neutral-300 hover:bg-white"

            >

              <ScrollText className="size-4 text-neutral-700" />

              Maak offerte

            </Link>

          ) : (

            <p className="rounded-md border border-dashed border-neutral-200 px-3 py-2 text-[11px] text-neutral-500">

              Maak offerte: koppel eerst een klant aan deze deal.

            </p>

          )}

          <button

            type="button"

            disabled

            title="Geen telefoon-integratie gekoppeld."

            className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50/50 px-3 py-2.5 text-left text-[12px] text-neutral-400"

          >

            <Phone className="size-4" />

            Bellen (niet gekoppeld)

          </button>

          <button

            type="button"

            disabled

            title="Geen e-mailprovider gekoppeld."

            className="flex w-full cursor-not-allowed items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50/50 px-3 py-2.5 text-left text-[12px] text-neutral-400"

          >

            <Mail className="size-4" />

            E-mail (niet gekoppeld)

          </button>

          <Link

            href="/admin/ops/studio"

            className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 hover:border-neutral-300 hover:bg-white"

          >

            <Sparkles className="size-4" />

            Site-studio

          </Link>

          <button

            type="button"

            disabled={busy}

            onClick={() => void patch({ at_risk: !deal.at_risk })}

            className="flex w-full items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[12px] font-medium text-neutral-900 hover:bg-white"

          >

            <XCircle className="size-4 text-neutral-500" />

            Risico aan/uit

          </button>

        </aside>

      </div>

    </div>

  );

}

