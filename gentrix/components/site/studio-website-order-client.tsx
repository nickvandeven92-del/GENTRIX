"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  siteLabel: string;
  previewToken: string;
  backHref: string;
};

const inputCls =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-zinc-400 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500";

const labelCls = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";

export function StudioWebsiteOrderClient({ slug, siteLabel, previewToken, backHref }: Props) {
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
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [hp, setHp] = useState("");

  const [addrBusy, setAddrBusy] = useState(false);
  const [addrMsg, setAddrMsg] = useState<string | null>(null);

  const [submitBusy, setSubmitBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const encSlug = useMemo(() => encodeURIComponent(slug), [slug]);

  const lookupAddress = useCallback(async () => {
    setAddrMsg(null);
    setAddrBusy(true);
    try {
      const q = new URLSearchParams({
        postcode: postalCode.trim(),
        huisnummer: houseNumber.trim(),
        toevoeging: houseSuffix.trim(),
      });
      const res = await fetch(`/api/public/nl-address?${q.toString()}`, { method: "GET" });
      const data = (await res.json()) as { ok?: boolean; error?: string; address?: { street: string; city: string; postalCode: string } };
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

  const submit = useCallback(async () => {
    setFormError(null);
    if (hp.trim()) return;
    if (!acceptTerms) {
      setFormError("Ga akkoord met de voorwaarden om door te gaan.");
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
          acceptTerms: true as const,
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
  ]);

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50/90 p-8 text-center dark:border-emerald-900/50 dark:bg-emerald-950/40">
        <h1 className="text-xl font-semibold text-emerald-950 dark:text-emerald-100">Bedankt!</h1>
        <p className="mt-3 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
          Je aanvraag is verstuurd. We nemen contact met je op over de betaling en de vervolgstappen voor{" "}
          <span className="font-medium">{siteLabel}</span>.
        </p>
        <Link
          href={backHref}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-800 underline hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Terug naar de site
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href={backHref}
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Terug naar {siteLabel}
      </Link>

      <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Website & abonnement</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Bestellen & betalen</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Vul je gegevens en Nederlandse bankrekening (IBAN) in. Na controle ontvang je bericht over de levering van je site.
        </p>
      </header>

      <div className="sr-only" aria-hidden>
        <label htmlFor="studio-order-hp">Laat leeg</label>
        <input id="studio-order-hp" name="website" autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} />
      </div>

      <form
        className="space-y-10"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Voornaam *
              <input className={cn(inputCls)} value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
            </label>
            <label className={labelCls}>
              Achternaam *
              <input className={cn(inputCls)} value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
            </label>
            <label className={cn(labelCls, "sm:col-span-2")}>
              Bedrijfsnaam (optioneel)
              <input className={cn(inputCls)} value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" />
            </label>
            <label className={labelCls}>
              E-mail *
              <input className={cn(inputCls)} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </label>
            <label className={labelCls}>
              Telefoon *
              <input className={cn(inputCls)} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Factuuradres</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Vul postcode en huisnummer in; klik daarna op &quot;Adres ophalen&quot; om straat en plaats automatisch te laten invullen
            (bron: PDOK / BAG).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>
              Postcode *
              <input
                className={cn(inputCls)}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="1234 AB"
                required
                autoComplete="postal-code"
              />
            </label>
            <label className={labelCls}>
              Huisnummer *
              <input className={cn(inputCls)} value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} required autoComplete="address-line2" />
            </label>
            <label className={cn(labelCls, "sm:col-span-2")}>
              Huisletter / toevoeging (bijv. A of bis)
              <input className={cn(inputCls)} value={houseSuffix} onChange={(e) => setHouseSuffix(e.target.value)} autoComplete="off" />
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                onClick={() => void lookupAddress()}
                disabled={addrBusy}
              >
                {addrBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                Adres ophalen
              </button>
              {addrMsg ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{addrMsg}</p> : null}
            </div>
            <label className={cn(labelCls, "sm:col-span-2")}>
              Straat *
              <input className={cn(inputCls)} value={street} onChange={(e) => setStreet(e.target.value)} required autoComplete="street-address" />
            </label>
            <label className={cn(labelCls, "sm:col-span-2")}>
              Plaats *
              <input className={cn(inputCls)} value={city} onChange={(e) => setCity(e.target.value)} required autoComplete="address-level2" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Betaling (SEPA)</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            IBAN wordt veilig bij ons geregistreerd voor incasso of overboeking volgens je offerte. Controleer je invoer.
          </p>
          <div className="mt-4 grid gap-4">
            <label className={labelCls}>
              IBAN (Nederland) *
              <input
                className={cn(inputCls, "font-mono tracking-wide")}
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="NL.."
                required
                autoComplete="iban"
              />
            </label>
            <label className={labelCls}>
              Ten name van (rekeninghouder) *
              <input className={cn(inputCls)} value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} required autoComplete="name" />
            </label>
            <label className={labelCls}>
              Opmerkingen (optioneel)
              <textarea className={cn(inputCls, "min-h-[88px] resize-y")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </label>
          </div>
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
          <input type="checkbox" className="mt-0.5 size-4 rounded border-zinc-400" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Ik ga akkoord met de algemene voorwaarden en het verwerken van deze gegevens voor deze bestelling. *
          </span>
        </label>

        {formError ? <p className="text-sm font-medium text-red-700 dark:text-red-300">{formError}</p> : null}

        <button
          type="submit"
          disabled={submitBusy}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {submitBusy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Versturen…
            </span>
          ) : (
            "Aanvraag versturen"
          )}
        </button>
      </form>
    </div>
  );
}
