"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Mail, Save } from "lucide-react";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  PLAN_TYPES,
  PLAN_TYPE_LABELS,
} from "@/lib/commercial/client-commercial";
import { readResponseJson } from "@/lib/api/read-response-json";
import type { ClientCommercialRow } from "@/lib/data/get-client-commercial-by-slug";
import { cn } from "@/lib/utils";

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = { initial: ClientCommercialRow };

export function ClientCommercialForm({ initial }: Props) {
  const router = useRouter();
  const slug = initial.subfolder_slug;

  const [billing_email, setBillingEmail] = useState(initial.billing_email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [company_legal_name, setCompanyLegalName] = useState(initial.company_legal_name ?? "");
  const [vat_number, setVatNumber] = useState(initial.vat_number ?? "");
  const [billing_address, setBillingAddress] = useState(initial.billing_address ?? "");
  const [plan_type, setPlanType] = useState<string>(initial.plan_type ?? "");
  const [plan_label, setPlanLabel] = useState(initial.plan_label ?? "");
  const [payment_status, setPaymentStatus] = useState(initial.payment_status);
  const [payment_provider, setPaymentProvider] = useState(initial.payment_provider ?? "");
  const [payment_reference, setPaymentReference] = useState(initial.payment_reference ?? "");
  const [subscription_renews_at, setSubscriptionRenewsAt] = useState(
    toDatetimeLocalValue(initial.subscription_renews_at),
  );
  const [delivered_at, setDeliveredAt] = useState(toDatetimeLocalValue(initial.delivered_at));
  const [contract_accepted_at, setContractAcceptedAt] = useState(
    toDatetimeLocalValue(initial.contract_accepted_at),
  );
  const [internal_notes, setInternalNotes] = useState(initial.internal_notes ?? "");
  const [pipeline_stage, setPipelineStage] = useState(initial.pipeline_stage);
  const [custom_domain, setCustomDomain] = useState(initial.custom_domain ?? "");
  const [domain_verified, setDomainVerified] = useState(initial.domain_verified);
  const [domain_dns_target, setDomainDnsTarget] = useState(initial.domain_dns_target ?? "");
  const [appointments_enabled, setAppointmentsEnabled] = useState(Boolean(initial.appointments_enabled));
  const [webshop_enabled, setWebshopEnabled] = useState(Boolean(initial.webshop_enabled));
  const [portal_invoices_enabled, setPortalInvoicesEnabled] = useState(
    Boolean(initial.portal_invoices_enabled),
  );
  const [portal_account_enabled, setPortalAccountEnabled] = useState(
    Boolean(initial.portal_account_enabled),
  );
  const [portal_user_id, setPortalUserId] = useState(initial.portal_user_id ?? "");

  const [saving, setSaving] = useState(false);
  const [inviteBusy, setInviteBusy] = useState<"invite" | "resend" | null>(null);
  const [revokingCancel, setRevokingCancel] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sendPortalInvite(resend: boolean) {
    setInviteBusy(resend ? "resend" : "invite");
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(slug)}/portal-invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend }),
      });
      const { data: json } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        portal_invite?: {
          status: string;
          email?: string;
          email_dispatched?: boolean;
          reason?: string;
        };
      }>(res);
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? `Uitnodigen mislukt (HTTP ${res.status}).`);
        return;
      }
      const pi = json?.portal_invite;
      if (pi?.status === "sent") {
        setMsg(
          pi.email_dispatched
            ? `Uitnodiging verstuurd naar ${pi.email}. De klant zet via de link een wachtwoord en logt in met dat e-mailadres.`
            : `Uitnodiging aangemaakt, maar e-mail niet verstuurd (RESEND_API_KEY ontbreekt). In development staat de link in de serverconsole.`,
        );
      } else if (pi?.status === "skipped" && pi.reason === "no_email") {
        setErr("Vul eerst een factuur-/contact e-mailadres in en sla op.");
      } else if (pi?.status === "skipped" && pi.reason === "already_linked") {
        setErr("Er is al een portaal-login gekoppeld. Gebruik “Opnieuw versturen” voor een nieuwe wachtwoordlink.");
      } else {
        setMsg("Klaar.");
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setInviteBusy(null);
    }
  }

  async function revokePortalSubscriptionCancel() {
    setRevokingCancel(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(slug)}/commercial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_cancel_at_period_end: false,
          subscription_cancel_requested_at: null,
        }),
      });
      const { data: json } = await readResponseJson<{ ok?: boolean; error?: string }>(res);
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? `Serverfout (${res.status}). Controleer netwerk of logs.`);
        return;
      }
      setMsg("Portaal-opzegging ingetrokken.");
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setRevokingCancel(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const body = {
        billing_email: billing_email || null,
        phone: phone || null,
        company_legal_name: company_legal_name || null,
        vat_number: vat_number || null,
        billing_address: billing_address || null,
        plan_type: plan_type || null,
        plan_label: plan_label || null,
        payment_status,
        payment_provider: payment_provider || null,
        payment_reference: payment_reference || null,
        subscription_renews_at: subscription_renews_at || null,
        delivered_at: delivered_at || null,
        contract_accepted_at: contract_accepted_at || null,
        internal_notes: internal_notes || null,
        pipeline_stage,
        custom_domain: custom_domain || null,
        domain_verified,
        domain_dns_target: domain_dns_target || null,
        appointments_enabled,
        webshop_enabled,
        portal_invoices_enabled,
        portal_account_enabled,
        portal_user_id: portal_user_id.trim() || null,
      };

      const res = await fetch(`/api/clients/${encodeURIComponent(slug)}/commercial`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { data: json } = await readResponseJson<{
        ok?: boolean;
        error?: string;
        portal_invite?: {
          status: string;
          email?: string;
          email_dispatched?: boolean;
          reason?: string;
          error?: string;
        };
      }>(res);
      if (!res.ok || !json?.ok) {
        setErr(json?.error ?? `Opslaan mislukt (HTTP ${res.status}).`);
        return;
      }
      const pi = json?.portal_invite;
      if (pi?.status === "sent") {
        setMsg(
          pi.email_dispatched
            ? `Opgeslagen. Automatische uitnodiging verstuurd naar ${pi.email}.`
            : `Opgeslagen. Portaal-login aangemaakt; e-mail niet verstuurd (RESEND_API_KEY). Zie serverconsole (development) of gebruik “Uitnodiging versturen”.`,
        );
      } else if (pi?.status === "error") {
        setMsg(`Opgeslagen. Portaal-uitnodiging mislukt: ${pi.error ?? "onbekend"}. Corrigeer en gebruik “Uitnodiging versturen”.`);
      } else {
        setMsg("Opgeslagen.");
      }
      router.refresh();
    } catch {
      setErr("Netwerkfout.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100";

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href={`/admin/clients/${encodeURIComponent(slug)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar overzicht
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Commercie & domein</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {initial.name} · <code className="rounded bg-zinc-200 px-1 font-mono text-xs dark:bg-zinc-800">{slug}</code>
        </p>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vul dit handmatig bij; koppel later Stripe/Mollie door <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">payment_reference</code> te vullen.{" "}
        <Link href={`/admin/editor/${encodeURIComponent(slug)}`} className="font-medium text-blue-800 underline dark:text-blue-400">
          Naar HTML-editor
        </Link>
      </p>

      {err && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {err}
        </p>
      )}
      {msg && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" aria-hidden />
          {msg}
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Contact & facturatie</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Factuur e-mail
            <input
              type="email"
              value={billing_email}
              onChange={(e) => setBillingEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Telefoon
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Bedrijfsnaam (juridisch)
            <input
              type="text"
              value={company_legal_name}
              onChange={(e) => setCompanyLegalName(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            BTW-nummer
            <input type="text" value={vat_number} onChange={(e) => setVatNumber(e.target.value)} className={inputCls} />
          </label>
          <div className="sm:col-span-2" />
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Factuuradres
            <textarea
              value={billing_address}
              onChange={(e) => setBillingAddress(e.target.value)}
              rows={3}
              className={cn(inputCls, "font-sans")}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Plan & betaling</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Plantype
            <select
              value={plan_type}
              onChange={(e) => setPlanType(e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PLAN_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Planlabel (bijv. Abonnement Basis)
            <input type="text" value={plan_label} onChange={(e) => setPlanLabel(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Betalingsstatus
            <select
              value={payment_status}
              onChange={(e) => setPaymentStatus(e.target.value as typeof payment_status)}
              className={inputCls}
            >
              {PAYMENT_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_STATUS_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Provider (stripe, mollie, …)
            <input
              type="text"
              value={payment_provider}
              onChange={(e) => setPaymentProvider(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Externe referentie (checkout session id, incasso-id)
            <input
              type="text"
              value={payment_reference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className={cn(inputCls, "font-mono text-xs")}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Abonnement — volgende verlenging
            <input
              type="datetime-local"
              value={subscription_renews_at}
              onChange={(e) => setSubscriptionRenewsAt(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Levering & contract</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Pipeline-fase
            <select
              value={pipeline_stage}
              onChange={(e) => setPipelineStage(e.target.value as typeof pipeline_stage)}
              className={inputCls}
            >
              {PIPELINE_STAGES.map((t) => (
                <option key={t} value={t}>
                  {PIPELINE_STAGE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Afgeleverd op
            <input
              type="datetime-local"
              value={delivered_at}
              onChange={(e) => setDeliveredAt(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Contract / akkoord op
            <input
              type="datetime-local"
              value={contract_accepted_at}
              onChange={(e) => setContractAcceptedAt(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Interne notities
            <textarea
              value={internal_notes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={5}
              className={cn(inputCls, "font-sans")}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-6 dark:border-violet-900/40 dark:bg-violet-950/20">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Klantportaal</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Iedere actieve klant heeft <strong>altijd</strong> toegang tot{" "}
          <code className="rounded bg-white px-1 font-mono text-[11px] dark:bg-zinc-900">/portal/{slug}</code> (na inloggen +
          MFA). Hieronder bepaal je welke <strong>tabbladen</strong> zichtbaar zijn.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={portal_invoices_enabled}
            onChange={(e) => setPortalInvoicesEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium">Facturen in portaal</span>
            <span className="mt-0.5 block text-xs font-normal text-zinc-600 dark:text-zinc-400">
              Tab &quot;Facturen&quot; en detailpagina&apos;s voor verzonden/betaalde facturen.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={portal_account_enabled}
            onChange={(e) => setPortalAccountEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium">Account in portaal</span>
            <span className="mt-0.5 block text-xs font-normal text-zinc-600 dark:text-zinc-400">
              Tab &quot;Account&quot;: abonnement, betalingsinfo en opzeggen.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={appointments_enabled}
            onChange={(e) => setAppointmentsEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium">Afspraken-module</span>
            <span className="mt-0.5 block text-xs font-normal text-zinc-600 dark:text-zinc-400">
              Tab &quot;Afspraken&quot;: plannen, verzetten, annuleren en .ics-download.
            </span>
          </span>
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={webshop_enabled}
            onChange={(e) => setWebshopEnabled(e.target.checked)}
            className="mt-0.5 size-4 rounded border-zinc-300"
          />
          <span>
            <span className="font-medium">Webshop op de marketingpagina</span>
            <span className="mt-0.5 block text-xs font-normal text-zinc-600 dark:text-zinc-400">
              Zichtbare shop-sectie en links naar <code className="font-mono text-[11px]">/winkel/…</code> op de publieke
              site (los van het portaal).
            </span>
          </span>
        </label>
        <label className="mt-5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Portaal-login (Supabase user UUID)
          <input
            type="text"
            value={portal_user_id}
            onChange={(e) => setPortalUserId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
            className={inputCls}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block font-normal text-zinc-500 dark:text-zinc-400">
            Wordt normaal automatisch gevuld bij de eerste portaal-uitnodiging. Handmatig aanpassen kan (Auth-user UUID). Dan sturen{" "}
            <code className="rounded bg-white px-1 font-mono text-[11px] dark:bg-zinc-900">/home</code> en{" "}
            <code className="rounded bg-white px-1 font-mono text-[11px] dark:bg-zinc-900">/dashboard</code> door naar{" "}
            <code className="rounded bg-white px-1 font-mono text-[11px] dark:bg-zinc-900">/portal/{slug}</code> bij precies één koppeling. Leeg laten om te ontkoppelen.
          </span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(inviteBusy)}
            onClick={() => void sendPortalInvite(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {inviteBusy === "invite" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Mail className="size-3.5" aria-hidden />}
            Uitnodiging versturen
          </button>
          <button
            type="button"
            disabled={Boolean(inviteBusy)}
            onClick={() => void sendPortalInvite(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {inviteBusy === "resend" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Mail className="size-3.5" aria-hidden />}
            Opnieuw versturen (wachtwoordlink)
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Zodra de klant <strong>betaald</strong> is (betalingsstatus of pipeline vanaf “Betaald”) één factuurmail heeft en nog geen login, sturen we automatisch een mail met gebruikersnaam (e-mail) en een link om het wachtwoord te kiezen.
        </p>
        {initial.subscription_cancel_at_period_end ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">Abonnement opgezegd via klantportaal</p>
            <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-200/85">
              De klant heeft opzeggen bevestigd (per einde lopende periode). Trek dit alleen in als je het contract voortzet.
            </p>
            <button
              type="button"
              disabled={revokingCancel}
              onClick={() => void revokePortalSubscriptionCancel()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-zinc-950 dark:text-amber-100 dark:hover:bg-zinc-900"
            >
              {revokingCancel ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Opzegging intrekken
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900/40 dark:bg-blue-950/20">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Eigen domein van de klant</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          Vul het <strong>hostname</strong> exact zo in als bezoekers het intypen (bijv. <code className="text-xs">www.klant.nl</code>).
          De app koppelt dat domein intern aan deze site: bezoekers zien <strong>geen</strong> <code className="text-xs">/site/slug</code>{" "}
          in de adresbalk. Jij moet nog wel: (1) dit domein toevoegen in je hosting (bijv. Vercel → Domains) + TLS; (2) DNS
          (CNAME) laten wijzen zoals je host voorschrijft; (3) in <code className="text-xs">.env</code>{" "}
          <code className="text-xs">NEXT_PUBLIC_PRIMARY_HOST</code> zetten op jouw eigen studio-domein zodat dat niet per ongeluk
          als klantdomein wordt gezien. Preview op jouw project-URL blijft via <code className="text-xs">/site/slug</code>.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            Gewenst domein (hostname, zonder https)
            <input
              type="text"
              placeholder="www.voorbeeld.nl"
              value={custom_domain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className={cn(inputCls, "font-mono")}
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 sm:col-span-2">
            CNAME-doel voor de klant (wat jij ze doorgeeft)
            <input
              type="text"
              placeholder="sites.jouwstudio.nl of cname.vercel-dns.com"
              value={domain_dns_target}
              onChange={(e) => setDomainDnsTarget(e.target.value)}
              className={cn(inputCls, "font-mono text-xs")}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={domain_verified}
              onChange={(e) => setDomainVerified(e.target.checked)}
              className="size-4 rounded border-zinc-300"
            />
            DNS / SSL gecontroleerd en live
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-950 disabled:opacity-60 dark:bg-blue-800"
      >
        {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
        Opslaan
      </button>
    </form>
  );
}
