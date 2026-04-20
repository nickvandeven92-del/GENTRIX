import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { getClientCommercialBySlug } from "@/lib/data/get-client-commercial-by-slug";
import { listSepaMandates } from "@/lib/data/list-sepa-mandates";
import { formatDocumentDate } from "@/lib/commercial/billing-helpers";
import {
  BILLING_INTERVAL_LABELS,
  BILLING_STATUS_LABELS,
  BILLING_STATUS_COLORS,
  SEPA_MANDATE_STATUS_LABELS,
  type BillingInterval,
  type BillingStatus,
} from "@/lib/commercial/client-commercial";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const row = await getClientCommercialBySlug(decodeURIComponent(slug ?? ""));
  if (!row) return { title: "Abonnement" };
  return { title: `Abonnement — ${row.name}` };
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
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", cls[color])}>
      {label}
    </span>
  );
}

function MandateStatusIcon({ status }: { status: string }) {
  if (status === "valid") return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  if (status === "revoked") return <XCircle className="size-4 text-red-500" aria-hidden />;
  if (status === "invalid") return <XCircle className="size-4 text-red-500" aria-hidden />;
  return <Clock className="size-4 text-amber-500" aria-hidden />;
}

function ServiceStatusRow({
  label,
  active,
  reason,
}: {
  label: string;
  active: boolean;
  reason?: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
      <div className="flex items-center gap-1.5">
        {active ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <AlertCircle className="size-4 text-amber-500" aria-hidden />
        )}
        <span className={cn("text-xs font-medium", active ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300")}>
          {active ? "Actief" : "Gepauzeerd"}
        </span>
        {!active && reason ? (
          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">— {reason}</span>
        ) : null}
      </div>
    </div>
  );
}

export default async function ClientAbonnementPage({ params }: PageProps) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug ?? "");
  if (!decoded) notFound();

  const row = await getClientCommercialBySlug(decoded);
  if (!row) notFound();

  const mandates = await listSepaMandates(row.id);
  const activeMandates = mandates.filter((m) => m.status === "valid");

  const billingStatus = (row as { billing_status?: string }).billing_status ?? "active";
  const billingInterval = (row as { billing_interval?: string | null }).billing_interval ?? null;
  const subscriptionStartDate = (row as { subscription_start_date?: string | null }).subscription_start_date ?? null;
  const mollieCustomerId = (row as { mollie_customer_id?: string | null }).mollie_customer_id ?? null;
  const mollieSubscriptionId = (row as { mollie_subscription_id?: string | null }).mollie_subscription_id ?? null;
  const prenotificationAgreement = (row as { prenotification_agreement?: string | null }).prenotification_agreement ?? null;
  const serviceSuspended = (row as { service_suspended?: boolean }).service_suspended ?? false;
  const suspensionReason = (row as { service_suspension_reason?: string | null }).service_suspension_reason ?? null;
  const domainPaused = (row as { domain_paused?: boolean }).domain_paused ?? false;
  const emailAddonPaused = (row as { email_addon_paused?: boolean }).email_addon_paused ?? false;
  const bookingPaused = (row as { booking_paused?: boolean }).booking_paused ?? false;
  const shopPaused = (row as { shop_paused?: boolean }).shop_paused ?? false;
  const checkoutConsentTextVersion = (row as { checkout_consent_text_version?: string | null }).checkout_consent_text_version ?? null;
  const checkoutConsentIp = (row as { checkout_consent_ip?: string | null }).checkout_consent_ip ?? null;
  const checkoutConfirmationEmailSent = (row as { checkout_confirmation_email_sent?: boolean }).checkout_confirmation_email_sent ?? false;

  return (
    <div className="space-y-8 pb-10">

      {/* === Contract & abonnement === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Contract & abonnement
          </h2>
          <BillingStatusBadge status={billingStatus} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Plantype</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {row.plan_label || row.plan_type || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Facturatie-interval</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {billingInterval
                ? (BILLING_INTERVAL_LABELS[billingInterval as BillingInterval] ?? billingInterval)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Startdatum abonnement</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {subscriptionStartDate ? formatDocumentDate(subscriptionStartDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Verlengingsdatum</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {row.subscription_renews_at ? formatDocumentDate(row.subscription_renews_at) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Contract geaccepteerd</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {row.contract_accepted_at ? formatDocumentDate(row.contract_accepted_at) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Betaalmethode</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {row.payment_provider || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Pre-notificatie</dt>
            <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {prenotificationAgreement || "—"}
            </dd>
          </div>
          {mollieCustomerId ? (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Mollie klant-ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{mollieCustomerId}</dd>
            </div>
          ) : null}
          {mollieSubscriptionId ? (
            <div>
              <dt className="text-xs text-zinc-500 dark:text-zinc-400">Mollie abonnement-ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{mollieSubscriptionId}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* === SEPA-machtiging === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            SEPA-machtiging
          </h2>
          {activeMandates.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {activeMandates.length} geldige machtiging{activeMandates.length !== 1 ? "en" : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Geen machtiging
            </span>
          )}
        </div>

        {mandates.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nog geen SEPA-machtiging vastgelegd. Voeg er een toe zodra de Mollie-koppeling actief is of registreer een handmatige machtiging.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {mandates.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "rounded-lg border p-4",
                  m.status === "valid"
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                    : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MandateStatusIcon status={m.status} />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {m.mandate_reference}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {SEPA_MANDATE_STATUS_LABELS[m.status] ?? m.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Mandaatdatum</dt>
                    <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
                      {formatDocumentDate(m.mandate_date)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">IBAN (gemaskeerd)</dt>
                    <dd className="mt-0.5 font-mono font-medium text-zinc-900 dark:text-zinc-50">
                      **** **** **** {m.iban_last4}
                    </dd>
                  </div>
                  {m.account_holder ? (
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Rekeninghouder</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">{m.account_holder}</dd>
                    </div>
                  ) : null}
                  {m.bank_name ? (
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Bank</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">{m.bank_name}</dd>
                    </div>
                  ) : null}
                  {m.prenotification_agreement ? (
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Pre-notificatie</dt>
                      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">{m.prenotification_agreement}</dd>
                    </div>
                  ) : null}
                  {m.mollie_mandate_id ? (
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Mollie mandaat-ID</dt>
                      <dd className="mt-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{m.mollie_mandate_id}</dd>
                    </div>
                  ) : null}
                </dl>
                {/* Consent-bewijs */}
                <div className="mt-3 border-t border-zinc-200/60 pt-3 dark:border-zinc-700/60">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Consent-bewijs</p>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tekst-versie</dt>
                      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">{m.consent_text_version || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tijdstip akkoord</dt>
                      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                        {m.consent_at
                          ? new Date(m.consent_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">IP-adres</dt>
                      <dd className="mt-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{m.consent_ip || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">Bevestigingsmail</dt>
                      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                        {m.confirmation_email_sent ? "Verstuurd" : "Niet verstuurd"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* === Consent & bewijs (klant-niveau) === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Checkout-consent (klant)
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Tekst-versie akkoord</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">{checkoutConsentTextVersion || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">IP-adres bij akkoord</dt>
            <dd className="mt-0.5 font-mono text-xs text-zinc-700 dark:text-zinc-300">{checkoutConsentIp || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Bevestigingsmail verstuurd</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {checkoutConfirmationEmailSent ? "Ja" : "Nee"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Contract geaccepteerd op</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-50">
              {row.contract_accepted_at
                ? new Date(row.contract_accepted_at).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" })
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* === Service status === */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Service status
          </h2>
          {serviceSuspended ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="size-3.5" aria-hidden />
              Dienst geschorst
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Alles actief
            </span>
          )}
        </div>

        {suspensionReason ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/20 dark:text-red-200">
            <strong>Reden van schorsing:</strong> {suspensionReason}
          </div>
        ) : null}

        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          <ServiceStatusRow label="Website (publieke site)" active={!serviceSuspended} reason={serviceSuspended ? suspensionReason : null} />
          <ServiceStatusRow label="Custom domein" active={!domainPaused} />
          <ServiceStatusRow label="E-mail add-on" active={!emailAddonPaused} />
          <ServiceStatusRow
            label="Booking / agenda module"
            active={row.appointments_enabled && !bookingPaused}
          />
          <ServiceStatusRow
            label="Webshop module"
            active={row.webshop_enabled && !shopPaused}
          />
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Schorsing via de betalingenstatus koppel je in de <strong>Betalingen</strong>-tab. Schakel modules in/uit via{" "}
          <strong>Commercie & domein</strong>.
        </p>
      </section>

    </div>
  );
}
