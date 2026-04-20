"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Gentrix bedrijfsgegevens ────────────────────────────────────────────────
// Pas deze constanten aan naar jouw KvK / BTW / adres.
const GENTRIX = {
  naam: "Gentrix",
  kvk: "VUL_KVK_IN",
  btw: "VUL_BTW_IN",
  adres: "VUL_ADRES_IN",
  email: "info@gentrix.nl",
  web: "gentrix.nl",
};

// ─── Prijzen (excl. 21% BTW) ─────────────────────────────────────────────────
const BTW = 0.21;

const BASE_PRICE = 25; // € per maand, excl. BTW

const MODULES = [
  { id: "booking", label: "Boekingssysteem", desc: "Online afspraken + agenda", price: 10 },
  { id: "webshop", label: "Webshop", desc: "Online verkopen via je site", price: 15 },
  { id: "email", label: "Zakelijke e-mail", desc: "E-mail op eigen domein", price: 8 },
] as const;

type ModuleId = (typeof MODULES)[number]["id"];

// ─── Styling helpers ─────────────────────────────────────────────────────────
const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/30 placeholder:text-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";
const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";
const cardCls =
  "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60";
const checkboxRowCls =
  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors";

type Props = {
  slug: string;
  siteLabel: string;
  previewToken: string;
  backHref: string;
};

// ─── Price summary component ──────────────────────────────────────────────────
function PriceSummary({
  selectedModules,
  compact = false,
}: {
  selectedModules: Set<ModuleId>;
  compact?: boolean;
}) {
  const moduleTotal = MODULES.filter((m) => selectedModules.has(m.id)).reduce(
    (s, m) => s + m.price,
    0,
  );
  const exclBtw = BASE_PRICE + moduleTotal;
  const inclBtw = exclBtw * (1 + BTW);

  if (compact) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Totaal p/m (incl. BTW)</span>
          <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {fmtEur(inclBtw)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(cardCls, "space-y-3")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Overzicht
      </p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-zinc-700 dark:text-zinc-300">Website + hosting</span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
            {fmtEur(BASE_PRICE)}/m
          </span>
        </div>
        {MODULES.filter((m) => selectedModules.has(m.id)).map((m) => (
          <div key={m.id} className="flex justify-between gap-2">
            <span className="text-zinc-700 dark:text-zinc-300">{m.label}</span>
            <span className="tabular-nums text-zinc-900 dark:text-zinc-50">
              +{fmtEur(m.price)}/m
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>Subtotaal excl. BTW</span>
          <span className="tabular-nums">{fmtEur(exclBtw)}/m</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>BTW (21%)</span>
          <span className="tabular-nums">{fmtEur(exclBtw * BTW)}/m</span>
        </div>
        <div className="mt-1.5 flex justify-between font-semibold">
          <span className="text-sm text-zinc-900 dark:text-zinc-50">Totaal p/m</span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-50">{fmtEur(inclBtw)}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Incl. BTW · maandelijks geïncasseerd
        </p>
      </div>
    </div>
  );
}

function fmtEur(n: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Pakket", "Gegevens", "Akkoord"] as const;
  return (
    <nav aria-label="Stappen" className="mb-8 flex items-center gap-0">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-400 dark:border-zinc-600",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : n}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "mb-5 h-px flex-1 transition-colors",
                  done ? "bg-emerald-400" : "bg-zinc-200 dark:bg-zinc-700",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Bedrijfsgegevens blok ────────────────────────────────────────────────────
function GentrixInfo() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400">
      <p className="mb-2 font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Leverancier
      </p>
      <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">Bedrijf:</strong>{" "}
          {GENTRIX.naam}
        </span>
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">KvK:</strong>{" "}
          {GENTRIX.kvk}
        </span>
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">BTW:</strong>{" "}
          {GENTRIX.btw}
        </span>
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">Adres:</strong>{" "}
          {GENTRIX.adres}
        </span>
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">E-mail:</strong>{" "}
          <a href={`mailto:${GENTRIX.email}`} className="underline hover:text-zinc-900">
            {GENTRIX.email}
          </a>
        </span>
        <span>
          <strong className="font-medium text-zinc-700 dark:text-zinc-300">Web:</strong>{" "}
          <a
            href={`https://${GENTRIX.web}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-zinc-900"
          >
            {GENTRIX.web}
          </a>
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function StudioWebsiteOrderClient({ slug, siteLabel, previewToken, backHref }: Props) {
  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: modules
  const [selectedModules, setSelectedModules] = useState<Set<ModuleId>>(new Set());

  // Step 2: contact
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [houseSuffix, setHouseSuffix] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [notes, setNotes] = useState("");

  // Step 3: consents
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptSepa, setAcceptSepa] = useState(false);
  const [acceptWithdrawal, setAcceptWithdrawal] = useState(false);

  // Honeypot
  const [hp, setHp] = useState("");

  // Address lookup
  const [addrBusy, setAddrBusy] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);

  // Submit
  const [submitBusy, setSubmitBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const encSlug = useMemo(() => encodeURIComponent(slug), [slug]);

  const toggleModule = (id: ModuleId) =>
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const lookupAddress = useCallback(async () => {
    setAddrMsg(null);
    setAddrBusy(true);
    try {
      const q = new URLSearchParams({
        postcode: postalCode.trim(),
        huisnummer: houseNumber.trim(),
        toevoeging: houseSuffix.trim(),
      });
      const res = await fetch(`/api/public/nl-address?${q.toString()}`);
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        address?: { street: string; city: string; postalCode: string };
      };
      if (!res.ok || !data.ok || !data.address) {
        setAddrMsg(data.error ?? "Adres niet gevonden.");
        return;
      }
      setStreet(data.address.street);
      setCity(data.address.city);
      setPostalCode(data.address.postalCode);
      setAddrMsg("Adres ingevuld — controleer straat en plaats.");
    } catch {
      setAddrMsg("Netwerkfout bij adres ophalen.");
    } finally {
      setAddrBusy(false);
    }
  }, [postalCode, houseNumber, houseSuffix]);

  const step2Valid =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    phone.trim() &&
    postalCode.trim() &&
    houseNumber.trim() &&
    street.trim() &&
    city.trim() &&
    iban.trim() &&
    accountHolder.trim();

  const submit = useCallback(async () => {
    setFormError(null);
    if (hp.trim()) return;
    if (!acceptTerms || !acceptSepa || !acceptWithdrawal) {
      setFormError("Vink alle drie de vakjes aan om door te gaan.");
      return;
    }
    setSubmitBusy(true);
    try {
      const res = await fetch(`/api/public/site/${encSlug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: previewToken.trim() || undefined,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          companyName: companyName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          postalCode: postalCode.trim(),
          houseNumber: houseNumber.trim(),
          houseSuffix: houseSuffix.trim() || undefined,
          street: street.trim(),
          city: city.trim(),
          iban: iban.trim(),
          accountHolder: accountHolder.trim(),
          notes: notes.trim() || undefined,
          selectedModules: Array.from(selectedModules),
          acceptTerms: true as const,
          acceptSepa: true as const,
          acceptWithdrawal: true as const,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setFormError(data.error ?? "Versturen mislukt.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("Netwerkfout.");
    } finally {
      setSubmitBusy(false);
    }
  }, [
    hp,
    acceptTerms,
    acceptSepa,
    acceptWithdrawal,
    encSlug,
    previewToken,
    firstName,
    lastName,
    companyName,
    email,
    phone,
    postalCode,
    houseNumber,
    houseSuffix,
    street,
    city,
    iban,
    accountHolder,
    notes,
    selectedModules,
  ]);

  // ── Bevestiging ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Bestelling ontvangen!
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Je aanvraag voor <strong className="text-zinc-800 dark:text-zinc-200">{siteLabel}</strong>{" "}
          is verwerkt. Je ontvangt een bevestiging op <strong>{email}</strong>. We stellen je
          abonnement in en nemen contact op over de eerste incasso via iDEAL.
        </p>
        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
          Vragen? Mail naar{" "}
          <a href={`mailto:${GENTRIX.email}`} className="underline">
            {GENTRIX.email}
          </a>
          .
        </p>
        <Link
          href={backHref}
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar de site
        </Link>
      </div>
    );
  }

  // ── Layout wrapper ───────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {/* Terug link */}
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar {siteLabel}
      </Link>

      {/* Header */}
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {GENTRIX.naam} · Website & abonnement
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bestellen & betalen
        </h1>
      </header>

      <Stepper step={step} />

      {/* Honeypot */}
      <div className="sr-only" aria-hidden>
        <input
          name="website"
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
        />
      </div>

      {/* ── Stap 1: Pakketkeuze ───────────────────────────────────────────── */}
      {step === 1 ? (
        <div className="space-y-6">
          {/* Basis */}
          <div className={cardCls}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Website + hosting
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Professionele website op maat, inclusief hosting en beheer.
                </p>
                <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                    Website op eigen domein
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                    SSL-certificaat inbegrepen
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                    Onderhoud & updates
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                    Maandelijks opzegbaar
                  </li>
                </ul>
                <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Niet inbegrepen: domeinnaam (apart te registreren), e-mail (optionele add-on),
                  advertentiekosten.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {fmtEur(BASE_PRICE)}
                </p>
                <p className="text-xs text-zinc-500">excl. BTW / maand</p>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {fmtEur(BASE_PRICE * (1 + BTW))} incl. BTW
                </p>
              </div>
            </div>
          </div>

          {/* Add-ons */}
          <div className={cardCls}>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Optionele modules
            </h2>
            <div className="space-y-3">
              {MODULES.map((m) => {
                const active = selectedModules.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={cn(
                      checkboxRowCls,
                      active
                        ? "border-zinc-900 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-800/60"
                        : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded accent-zinc-900 dark:accent-zinc-100"
                      checked={active}
                      onChange={() => toggleModule(m.id)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {m.label}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.desc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                        +{fmtEur(m.price)}/m
                      </p>
                      <p className="text-xs text-zinc-400">excl. BTW</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Prijs samenvatting */}
          <PriceSummary selectedModules={selectedModules} />

          {/* Contract info */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-4 text-xs leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
            <p className="font-semibold">Abonnement</p>
            <p className="mt-1">
              Maandelijks abonnement · automatisch verlengd · maandelijks opzegbaar via je
              klantportaal of per e-mail aan {GENTRIX.email}. De opzegtermijn bedraagt 30 dagen.
              Automatische incasso via SEPA; eerste betaling via iDEAL.
            </p>
          </div>

          <GentrixInfo />

          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Doorgaan naar gegevens
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {/* ── Stap 2: Gegevens ──────────────────────────────────────────────── */}
      {step === 2 ? (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (step2Valid) setStep(3);
          }}
        >
          {/* Prijs compact */}
          <PriceSummary selectedModules={selectedModules} compact />

          {/* Contact */}
          <div className={cardCls}>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelCls}>
                Voornaam *
                <input
                  className={inputCls}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </label>
              <label className={labelCls}>
                Achternaam *
                <input
                  className={inputCls}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </label>
              <label className={cn(labelCls, "sm:col-span-2")}>
                Bedrijfsnaam (optioneel)
                <input
                  className={inputCls}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  autoComplete="organization"
                />
              </label>
              <label className={labelCls}>
                E-mailadres *
                <input
                  className={inputCls}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className={labelCls}>
                Telefoonnummer *
                <input
                  className={inputCls}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                />
              </label>
            </div>
          </div>

          {/* Factuuradres */}
          <div className={cardCls}>
            <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">Factuuradres</h2>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              Vul postcode en huisnummer in en klik op &quot;Adres ophalen&quot;.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelCls}>
                Postcode *
                <input
                  className={inputCls}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1234 AB"
                  required
                  autoComplete="postal-code"
                />
              </label>
              <label className={labelCls}>
                Huisnummer *
                <input
                  className={inputCls}
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  required
                />
              </label>
              <label className={cn(labelCls, "sm:col-span-2")}>
                Toevoeging (optioneel)
                <input
                  className={inputCls}
                  value={houseSuffix}
                  onChange={(e) => setHouseSuffix(e.target.value)}
                  placeholder="bijv. A of bis"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => void lookupAddress()}
                  disabled={addrBusy}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {addrBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <MapPin className="size-4" aria-hidden />
                  )}
                  Adres ophalen
                </button>
                {addrMsg ? (
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{addrMsg}</p>
                ) : null}
              </div>
              <label className={cn(labelCls, "sm:col-span-2")}>
                Straat *
                <input
                  className={inputCls}
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  autoComplete="street-address"
                />
              </label>
              <label className={cn(labelCls, "sm:col-span-2")}>
                Plaats *
                <input
                  className={inputCls}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  autoComplete="address-level2"
                />
              </label>
            </div>
          </div>

          {/* SEPA / IBAN */}
          <div className={cardCls}>
            <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">
              Bankgegevens (SEPA-incasso)
            </h2>
            <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
              Het IBAN wordt gebruikt voor de maandelijkse automatische incasso. De eerste
              betaling verloopt via iDEAL.
            </p>
            <div className="grid gap-4">
              <label className={labelCls}>
                IBAN (Nederland) *
                <input
                  className={cn(inputCls, "font-mono tracking-wide")}
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="NL.."
                  required
                  autoComplete="off"
                />
              </label>
              <label className={labelCls}>
                Naam rekeninghouder *
                <input
                  className={inputCls}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className={labelCls}>
                Opmerkingen (optioneel)
                <textarea
                  className={cn(inputCls, "min-h-[72px] resize-y")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Terug
            </button>
            <button
              type="submit"
              disabled={!step2Valid}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Naar overzicht
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
        </form>
      ) : null}

      {/* ── Stap 3: Overzicht & akkoord ───────────────────────────────────── */}
      {step === 3 ? (
        <div className="space-y-6">
          {/* Besteloverzicht */}
          <div className={cardCls}>
            <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">
              Besteloverzicht
            </h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500">Naam</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {firstName} {lastName}
                </dd>
              </div>
              {companyName ? (
                <div>
                  <dt className="text-xs text-zinc-500">Bedrijf</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">{companyName}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-zinc-500">E-mail</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{email}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Telefoon</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{phone}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">Factuuradres</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {street} {houseNumber}
                  {houseSuffix ? ` ${houseSuffix}` : ""}, {postalCode} {city}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">IBAN</dt>
                <dd className="font-mono font-medium text-zinc-900 dark:text-zinc-50">
                  {iban.replace(/(.{4})/g, "$1 ").trim()}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-4 text-xs font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400"
            >
              Gegevens wijzigen
            </button>
          </div>

          <PriceSummary selectedModules={selectedModules} />

          {/* Betaalflow uitleg */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">Hoe verloopt de betaling?</p>
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              <li>
                Na je bestelling ontvang je een iDEAL-betaallink voor de{" "}
                <strong>eerste maand</strong>.
              </li>
              <li>
                Zodra de betaling is bevestigd starten wij de website.
              </li>
              <li>
                Iedere volgende maand wordt het bedrag automatisch via{" "}
                <strong>SEPA-incasso</strong> afgeschreven.
              </li>
            </ol>
          </div>

          {/* Juridische checkboxes */}
          <div className="space-y-3">
            {/* 1. Algemene voorwaarden */}
            <label
              className={cn(
                checkboxRowCls,
                acceptTerms
                  ? "border-zinc-800 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-800/50"
                  : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded accent-zinc-900 dark:accent-zinc-100"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                Ik heb de{" "}
                <a
                  href="/algemene-voorwaarden"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  algemene voorwaarden
                </a>{" "}
                en het{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 underline hover:text-blue-900 dark:text-blue-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  privacybeleid
                </a>{" "}
                gelezen en ga hiermee akkoord. *
              </span>
            </label>

            {/* 2. SEPA-machtiging */}
            <label
              className={cn(
                checkboxRowCls,
                acceptSepa
                  ? "border-zinc-800 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-800/50"
                  : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded accent-zinc-900 dark:accent-zinc-100"
                checked={acceptSepa}
                onChange={(e) => setAcceptSepa(e.target.checked)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
                  SEPA-incassomachtiging:
                </strong>{" "}
                Ik geef {GENTRIX.naam} toestemming om maandelijks het abonnementsbedrag van
                bovenstaand IBAN af te schrijven. Ik kan een afschrijving binnen 8 weken laten
                terugboeken via mijn bank. *
              </span>
            </label>

            {/* 3. Herroepingsrecht */}
            <label
              className={cn(
                checkboxRowCls,
                acceptWithdrawal
                  ? "border-zinc-800 bg-zinc-50 dark:border-zinc-400 dark:bg-zinc-800/50"
                  : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded accent-zinc-900 dark:accent-zinc-100"
                checked={acceptWithdrawal}
                onChange={(e) => setAcceptWithdrawal(e.target.checked)}
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong className="font-semibold text-zinc-900 dark:text-zinc-50">
                  Afstand herroepingsrecht:
                </strong>{" "}
                Ik ga akkoord dat {GENTRIX.naam} direct begint met de uitvoering van de dienst.
                Ik begrijp dat ik daarmee afstand doe van mijn 14 dagen bedenktijd
                (herroepingsrecht). *
              </span>
            </label>
          </div>

          <GentrixInfo />

          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Terug
            </button>
            {/* Juridisch verplichte button-tekst (ACM richtlijnen) */}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitBusy || !acceptTerms || !acceptSepa || !acceptWithdrawal}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3.5 text-sm font-bold text-white shadow hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {submitBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ShieldCheck className="size-4" aria-hidden />
              )}
              {submitBusy ? "Verwerken…" : "Abonnement starten met betalingsverplichting"}
            </button>
          </div>

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            Na je bestelling ontvang je een iDEAL-betaallink per e-mail. Pas na betaling start de
            dienst.
          </p>
        </div>
      ) : null}
    </div>
  );
}
