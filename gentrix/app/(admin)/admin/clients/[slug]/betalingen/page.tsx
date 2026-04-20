import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listPaymentAttempts } from "@/lib/data/list-payment-attempts";
import { listBillingEvents } from "@/lib/data/list-billing-events";
import { formatCurrencyEUR, parseInvoiceAmount } from "@/lib/commercial/billing-helpers";
import {
  BILLING_STATUS_LABELS,
  BILLING_STATUS_COLORS,
  BILLING_EVENT_LABELS,
  PAYMENT_ATTEMPT_STATUS_LABELS,
  type BillingStatus,
} from "@/lib/commercial/client-commercial";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Betalingen" };
  return { title: `Betalingen — ${row.name}` };
}

function BillingStatusBadge({ status }: { status: string }) {
  const color = BILLING_STATUS_COLORS[status as BillingStatus] ?? "zinc";
  const label = BILLING_STATUS_LABELS[status as BillingStatus] ?? status;
  const cls: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
    blue: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-800",
    amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
    red: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800",
    zinc: "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold", cls[color])}>
      {label}
    </span>
  );
}

function AttemptStatusIcon({ status }: { status: string }) {
  if (status === "paid") return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden />;
  if (status === "chargeback" || status === "failed")
    return <XCircle className="size-4 shrink-0 text-red-500" aria-hidden />;
  if (status === "pending" || status === "open")
    return <Clock className="size-4 shrink-0 text-amber-500" aria-hidden />;
  return <AlertCircle className="size-4 shrink-0 text-zinc-400" aria-hidden />;
}

function EventTypeIcon({ eventType }: { eventType: string }) {
  if (eventType === "payment_paid" || eventType === "manual_payment_received" || eventType === "service_reactivated")
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" aria-hidden />;
  if (
    eventType === "chargeback_received" ||
    eventType === "service_suspended" ||
    eventType === "mandate_revoked" ||
    eventType === "subscription_cancelled"
  )
    return <XCircle className="size-3.5 shrink-0 text-red-500" aria-hidden />;
  if (eventType === "payment_failed" || eventType === "retry_scheduled")
    return <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-hidden />;
  return <Clock className="size-3.5 shrink-0 text-zinc-400" aria-hidden />;
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

export default async function ClientBetalingenPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const [attempts, events] = await Promise.all([
    listPaymentAttempts(row.id),
    listBillingEvents(row.id),
  ]);

  const billingStatus = (row as { billing_status?: string }).billing_status ?? "active";
  const failedCount = (row as { failed_collection_count?: number }).failed_collection_count ?? 0;
  const lastReminderSentAt = (row as { last_reminder_sent_at?: string | null }).last_reminder_sent_at ?? null;
  const nextRetryAt = (row as { next_retry_at?: string | null }).next_retry_at ?? null;
  const manualPaymentLinkSent = (row as { manual_payment_link_sent?: boolean }).manual_payment_link_sent ?? false;
  const debtCollectionTransferred = (row as { debt_collection_transferred?: boolean }).debt_collection_transferred ?? false;
  const billingExceptionGranted = (row as { billing_exception_granted?: boolean }).billing_exception_granted ?? false;

  const isProblem = ["past_due", "retry_scheduled", "chargeback", "suspended"].includes(billingStatus);

  return (
    <div className="space-y-8 pb-10">

      {/* === Billing status header === */}
      <section className={cn(
        "rounded-xl border p-5",
        isProblem
          ? "border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
      )}>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Billing status
            </p>
            <div className="mt-1">
              <BillingStatusBadge status={billingStatus} />
            </div>
          </div>
          {failedCount > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/50 dark:bg-red-950/20">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Mislukte pogingen</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-400">{failedCount}</p>
            </div>
          ) : null}
          {nextRetryAt ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-950/20">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Volgende retry</p>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{fmtDatetime(nextRetryAt)}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* === Collections / opvolging === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Incasso-opvolging
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Mislukte incassopogingen</dt>
            <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", failedCount > 0 ? "text-red-700 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50")}>
              {failedCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Laatste herinnering verstuurd</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {lastReminderSentAt ? fmtDatetime(lastReminderSentAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Volgende retry gepland</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {nextRetryAt ? fmtDatetime(nextRetryAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Handmatige betaallink verstuurd</dt>
            <dd className={cn("mt-0.5 font-medium", manualPaymentLinkSent ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400")}>
              {manualPaymentLinkSent ? "Ja" : "Nee"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Dossier naar incassobureau</dt>
            <dd className={cn("mt-0.5 font-medium", debtCollectionTransferred ? "text-red-700 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400")}>
              {debtCollectionTransferred ? "Ja" : "Nee"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Uitzondering verleend</dt>
            <dd className={cn("mt-0.5 font-medium", billingExceptionGranted ? "text-amber-700 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400")}>
              {billingExceptionGranted ? "Ja" : "Nee"}
            </dd>
          </div>
        </dl>
      </section>

      {/* === Payment timeline === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Betaaltijdlijn
        </h2>

        {attempts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nog geen incassopogingen vastgelegd. Pogingen worden automatisch toegevoegd zodra de Mollie-koppeling actief is.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Datum</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Periode</th>
                  <th className="pb-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">Bedrag</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">Reden</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 hidden lg:table-cell">Mollie ID</th>
                  <th className="pb-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 hidden lg:table-cell">Webhook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                      {fmtDatetime(a.attempted_at)}
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-600 dark:text-zinc-400">
                      {a.period_label || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
                      {formatCurrencyEUR(parseInvoiceAmount(a.amount))}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5">
                        <AttemptStatusIcon status={a.status} />
                        <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                          {PAYMENT_ATTEMPT_STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-zinc-500 dark:text-zinc-400 max-w-[140px] truncate">
                      {a.failure_reason || a.manual_note || "—"}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-zinc-500 dark:text-zinc-400 hidden lg:table-cell whitespace-nowrap">
                      {a.mollie_payment_id || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-zinc-500 dark:text-zinc-400 hidden lg:table-cell whitespace-nowrap">
                      {a.webhook_received_at ? fmtDatetime(a.webhook_received_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* === Billing events auditlog === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Billing-auditlog
        </h2>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nog geen billing-events vastgelegd.
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {events.map((ev, i) => (
              <li
                key={ev.id}
                className={cn(
                  "flex gap-3 py-3",
                  i < events.length - 1 ? "border-b border-zinc-100 dark:border-zinc-800" : "",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  <EventTypeIcon eventType={ev.event_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {BILLING_EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                      {fmtDatetime(ev.occurred_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Door: {ev.actor}</span>
                    {ev.amount ? <span>Bedrag: {formatCurrencyEUR(parseInvoiceAmount(ev.amount))}</span> : null}
                  </div>
                  {ev.note ? (
                    <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300">{ev.note}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

    </div>
  );
}
