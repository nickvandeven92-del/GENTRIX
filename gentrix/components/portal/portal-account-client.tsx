"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatDocumentDateTime } from "@/lib/commercial/billing-helpers";
import { PAYMENT_STATUS_LABELS, PLAN_TYPE_LABELS } from "@/lib/commercial/client-commercial";
import type { PaymentStatus, PlanType } from "@/lib/commercial/client-commercial";
import { cn } from "@/lib/utils";

export type PortalAccountInitial = {
  plan_type: string | null;
  plan_label: string | null;
  payment_status: string;
  subscription_renews_at: string | null;
  subscription_cancel_at_period_end: boolean;
  subscription_cancel_requested_at: string | null;
  billing_email: string | null;
};

type Props = {
  slug: string;
  initial: PortalAccountInitial;
};

export function PortalAccountClient({ slug, initial }: Props) {
  const router = useRouter();
  const enc = encodeURIComponent(slug);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSubscription = initial.plan_type === "subscription";
  const planLabel =
    initial.plan_type && initial.plan_type in PLAN_TYPE_LABELS
      ? PLAN_TYPE_LABELS[initial.plan_type as PlanType]
      : initial.plan_type ?? "—";
  const payLabel =
    initial.payment_status in PAYMENT_STATUS_LABELS
      ? PAYMENT_STATUS_LABELS[initial.payment_status as PaymentStatus]
      : initial.payment_status;

  async function submitCancel() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/clients/${enc}/subscription/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: confirmText.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; already?: boolean };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? "Mislukt.");
        return;
      }
      setCancelOpen(false);
      setConfirmText("");
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Abonnement & betaling</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Plantype</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{planLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Planlabel</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{initial.plan_label?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Betalingsstatus</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{payLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Volgende verlenging</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {initial.subscription_renews_at
                ? formatDocumentDateTime(initial.subscription_renews_at)
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Factuur e-mail</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{initial.billing_email ?? "—"}</dd>
          </div>
        </dl>

        {isSubscription ? (
          <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            {initial.subscription_cancel_at_period_end ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-medium">Opzegging geregistreerd</p>
                <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                  Je abonnement loopt tot de eerstvolgende verlengingsdatum hierboven (of volgens je contract). Geen verdere
                  actie nodig in dit portaal.
                </p>
                {initial.subscription_cancel_requested_at ? (
                  <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/80">
                    Aangevraagd: {formatDocumentDateTime(initial.subscription_cancel_requested_at)}
                  </p>
                ) : null}
              </div>
            ) : !cancelOpen ? (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Abonnement opzeggen
              </button>
            ) : (
              <div className="max-w-md space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  Maandelijks opzegbaar. Typ <strong>OPZEGGEN</strong> om te bevestigen. Geen vragen, geen telefoon —
                  direct geregistreerd.
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="OPZEGGEN"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                  autoComplete="off"
                />
                {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitCancel()}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50",
                    )}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Bevestigen
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCancelOpen(false);
                      setConfirmText("");
                      setErr(null);
                    }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Geen doorlopend abonnement geregistreerd voor dit dossier. Wijzigingen gaan via je contactpersoon.
          </p>
        )}
      </section>
    </div>
  );
}
