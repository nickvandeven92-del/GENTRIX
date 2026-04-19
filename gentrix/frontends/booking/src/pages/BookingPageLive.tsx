import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { TZDate } from "@date-fns/tz";
import {
  useGentrixPublicBooking,
  type GentrixPublicBookingController,
} from "@/hooks/use-gentrix-public-booking";
import { formatPriceEur, ymdCompare } from "@/lib/gentrix-booking-helpers";
import { cn } from "@/lib/utils";

type StepId = "service" | "datetime" | "details" | "confirm" | "success";

export default function BookingPageLive() {
  const { slug: rawSlug } = useParams();
  const slug = decodeURIComponent(rawSlug ?? "").trim();
  const b = useGentrixPublicBooking({ slug });
  const [step, setStep] = useState<StepId>("datetime");
  const [successHadConfirmation, setSuccessHadConfirmation] = useState(false);
  const didInitStep = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      didInitStep.current = false;
    });
  }, [slug]);

  useEffect(() => {
    if (b.servicesLoading || didInitStep.current) return;
    didInitStep.current = true;
    if (b.requiresTreatmentChoice) queueMicrotask(() => setStep("service"));
  }, [b.servicesLoading, b.requiresTreatmentChoice]);

  const flowSteps = useMemo(() => {
    const base: { id: Exclude<StepId, "success">; label: string }[] = [];
    if (b.requiresTreatmentChoice) base.push({ id: "service", label: "Behandeling" });
    base.push({ id: "datetime", label: "Datum & tijd" }, { id: "details", label: "Gegevens" }, { id: "confirm", label: "Bevestigen" });
    return base;
  }, [b.requiresTreatmentChoice]);

  const stepIndex = step === "success" ? flowSteps.length : flowSteps.findIndex((s) => s.id === step);
  const businessLabel = b.businessName.trim() || slug || "Afspraak";

  function goBack() {
    b.setErr(null);
    if (step === "confirm") {
      setStep("details");
      return;
    }
    if (step === "details") {
      setStep("datetime");
      return;
    }
    if (step === "datetime" && b.requiresTreatmentChoice) {
      setStep("service");
    }
  }

  function goNextFromService() {
    if (!b.selectedServiceId) {
      b.setErr("Kies een behandeling.");
      return;
    }
    b.setErr(null);
    setStep("datetime");
  }

  function goNextFromDatetime() {
    if (!b.selectedSlot) {
      b.setErr("Kies een datum en tijdslot.");
      return;
    }
    if (b.staffForDay.requiresStaffSelection && !b.pickedStaffId) {
      b.setErr("Kies een medewerker.");
      return;
    }
    b.setErr(null);
    setStep("details");
  }

  function goNextFromDetails() {
    const email = b.bookerEmail.trim();
    if (!email || !email.includes("@")) {
      b.setErr("Vul een geldig e-mailadres in.");
      return;
    }
    b.setErr(null);
    setStep("confirm");
  }

  async function confirmAndBook() {
    const r = await b.submitBooking();
    if (r.ok) {
      setSuccessHadConfirmation(r.hadConfirmation);
      setStep("success");
    }
  }

  function newBooking() {
    b.resetFlow();
    setStep(b.requiresTreatmentChoice ? "service" : "datetime");
  }

  if (!slug) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 text-center text-muted-foreground">
        Geen studio-slug in de URL. Gebruik <code className="rounded bg-muted px-1">/book/mosham</code> (voorbeeld).
      </div>
    );
  }

  if (b.loadingMeta) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-background text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Agenda laden…
      </div>
    );
  }

  if (b.metaErr || !b.meta) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <p className="mx-auto max-w-lg rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {b.metaErr ?? "Agenda niet beschikbaar."}
        </p>
      </div>
    );
  }

  const meta = b.meta;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-heading text-lg font-bold">{businessLabel}</span>
        </div>
      </header>
      <main className="container py-10">
        <div className="mx-auto max-w-2xl space-y-6">
          {b.err ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{b.err}</p>
          ) : null}

          <section className="rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarPlus className="size-5 text-primary" aria-hidden />
              Afspraak maken — {businessLabel}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Doorloop de stappen om online te boeken. Tijden in {meta.timeZone}.</p>

            {step !== "success" ? (
              <div className="mb-8 mt-6 flex flex-wrap items-center gap-1 px-1">
                {flowSteps.map((s, i) => {
                  const done = i < stepIndex;
                  const active = i === stepIndex;
                  return (
                    <div key={s.id} className="flex min-w-0 flex-1 items-center last:flex-none">
                      <div className="flex min-w-0 flex-col items-center">
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                            done && "bg-primary text-primary-foreground",
                            active && !done && "bg-primary text-primary-foreground ring-4 ring-primary/25",
                            !done && !active && "bg-muted text-muted-foreground",
                          )}
                        >
                          {done ? <Check className="size-4" aria-hidden /> : i + 1}
                        </div>
                        <span
                          className={cn(
                            "mt-1 hidden text-center text-[11px] sm:block",
                            active ? "font-medium text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < flowSteps.length - 1 ? (
                        <div className={cn("mx-1 h-0.5 min-w-[12px] flex-1", done ? "bg-primary" : "bg-border")} />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {step !== "success" && stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden />
                Terug
              </button>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {step === "service" ? <ServiceStep b={b} onNext={goNextFromService} /> : null}
                {step === "datetime" ? <DateTimeStep b={b} onNext={goNextFromDatetime} /> : null}
                {step === "details" ? <DetailsStep b={b} onNext={goNextFromDetails} /> : null}
                {step === "confirm" ? <ConfirmStep b={b} businessName={businessLabel} onConfirm={() => void confirmAndBook()} /> : null}
                {step === "success" ? (
                  <SuccessStep
                    businessName={businessLabel}
                    hadConfirmation={successHadConfirmation}
                    onNew={newBooking}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}

function ServiceStep({ b, onNext }: { b: GentrixPublicBookingController; onNext: () => void }) {
  return (
    <div className="space-y-4">
      {b.servicesLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Behandelingen laden…
        </p>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-medium">Kies een behandeling</h2>
            <p className="mt-1 text-xs text-muted-foreground">Daarna kies je datum en tijd.</p>
          </div>
          <div className="space-y-2">
            {b.publicServices.map((svc) => {
              const on = b.selectedServiceId === svc.id;
              const pl = formatPriceEur(svc.price_cents);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => b.selectService(svc.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                    on ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{svc.name}</p>
                    {svc.description?.trim() ? <p className="text-xs text-muted-foreground">{svc.description}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {svc.duration_minutes} min{pl ? ` · ${pl}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onNext}
            className="mt-4 w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            Verder naar datum & tijd
          </button>
        </>
      )}
    </div>
  );
}

function DateTimeStep({ b, onNext }: { b: GentrixPublicBookingController; onNext: () => void }) {
  const meta = b.meta!;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium">Datum & tijd</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Kies een dag en een vrij slot
          {b.selectedService ? ` (${b.selectedService.duration_minutes} min)` : ` (${meta.slotDurationMinutes} min)`}.
        </p>
      </div>

      {b.requiresTreatmentChoice && !b.selectedServiceId ? (
        <p className="text-sm text-muted-foreground">Ga eerst terug en kies een behandeling.</p>
      ) : (
        <>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-border p-2 hover:bg-muted"
                aria-label="Vorige maand"
                onClick={() => {
                  if (b.viewM <= 1) {
                    b.setViewM(12);
                    b.setViewY((y) => y - 1);
                  } else b.setViewM((m) => m - 1);
                }}
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-sm font-medium">
                {new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(new Date(b.viewY, b.viewM - 1, 1))}
              </span>
              <button
                type="button"
                className="inline-flex items-center rounded-lg border border-border p-2 hover:bg-muted"
                aria-label="Volgende maand"
                onClick={() => {
                  if (b.viewM >= 12) {
                    b.setViewM(1);
                    b.setViewY((y) => y + 1);
                  } else b.setViewM((m) => m + 1);
                }}
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
              {["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {b.grid.map((cell, idx) => {
                const dis = ymdCompare(cell.ymd, meta.todayYmd) < 0 || ymdCompare(cell.ymd, meta.maxYmd) > 0;
                const sel = b.selectedYmd === cell.ymd;
                return (
                  <button
                    key={cell.ymd + idx}
                    type="button"
                    disabled={dis}
                    onClick={() => {
                      if (dis) return;
                      b.setSelectedYmd(cell.ymd);
                    }}
                    className={cn(
                      "aspect-square rounded-lg text-sm font-medium transition",
                      !cell.inMonth && "text-muted-foreground/70",
                      !dis && "text-foreground hover:bg-primary/15",
                      dis && "cursor-not-allowed opacity-40",
                      sel && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {cell.label}
                  </button>
                );
              })}
            </div>
          </div>

          {b.selectedYmd ? (
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium">
                {(() => {
                  const [sy, sm, sd] = b.selectedYmd.split("-").map(Number);
                  const dd = new TZDate(sy, sm - 1, sd, 12, 0, 0, meta.timeZone);
                  return new Intl.DateTimeFormat("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(dd);
                })()}
              </h3>

              {b.staffForDay.err ? (
                <p className="mt-3 text-sm text-destructive">{b.staffForDay.err}</p>
              ) : b.staffForDay.loading ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Medewerkers laden…
                </p>
              ) : b.staffForDay.requiresStaffSelection && b.staffForDay.staff.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Er is op deze dag geen medewerker beschikbaar om online te boeken.</p>
              ) : b.staffForDay.requiresStaffSelection && b.staffForDay.staff.length > 1 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">Kies een medewerker</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {b.staffForDay.staff.map((s) => {
                      const on = b.pickedStaffId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            b.setPickedStaffId(s.id);
                            b.setSelectedSlot(null);
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium transition",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:border-primary/50",
                          )}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : b.staffForDay.requiresStaffSelection && b.staffForDay.staff.length === 1 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Je boekt bij <strong>{b.staffForDay.staff[0]!.name}</strong>.
                </p>
              ) : null}

              {b.staffForDay.requiresStaffSelection && b.staffForDay.staff.length > 1 && !b.pickedStaffId ? (
                <p className="mt-4 text-sm text-muted-foreground">Kies een medewerker om de tijden te zien.</p>
              ) : b.staffForDay.requiresStaffSelection && b.staffForDay.staff.length === 0 ? null : (
                <>
                  <h4 className="mt-6 text-sm font-medium">Beschikbare tijden</h4>
                  {b.loadingSlots ? (
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Slots laden…
                    </p>
                  ) : b.slots.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Geen vrije tijden op deze dag.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.slots.map((s) => {
                        const active = b.selectedSlot?.starts_at === s.starts_at && b.selectedSlot?.ends_at === s.ends_at;
                        return (
                          <button
                            key={s.starts_at}
                            type="button"
                            onClick={() => b.setSelectedSlot(s)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-sm font-medium transition",
                              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50 hover:border-primary/50",
                            )}
                          >
                            {b.slotLabel(s)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecteer eerst een datum in de kalender.</p>
          )}

          <button
            type="button"
            onClick={onNext}
            disabled={!b.selectedSlot}
            className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
          >
            Verder naar gegevens
          </button>
        </>
      )}
    </div>
  );
}

function DetailsStep({ b, onNext }: { b: GentrixPublicBookingController; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Jouw gegevens</h2>
      <label className="block text-xs font-medium text-muted-foreground">
        Jouw naam
        <input
          value={b.bookerName}
          onChange={(e) => b.setBookerName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Voor- en achternaam"
          autoComplete="name"
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        E-mailadres <span className="text-destructive">*</span>
        <input
          type="email"
          required
          value={b.bookerEmail}
          onChange={(e) => b.setBookerEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="jij@voorbeeld.nl"
          autoComplete="email"
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Soort afspraak (optioneel)
        <input
          value={b.title}
          onChange={(e) => b.setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          placeholder="Bijv. Intake"
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground">
        Opmerking (optioneel)
        <textarea
          value={b.notes}
          onChange={(e) => b.setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={b.wantsConfirmation}
            onChange={(e) => b.setWantsConfirmation(e.target.checked)}
            className="mt-0.5"
          />
          <span>Ja, stuur mij een bevestiging per e-mail (inclusief agenda-bestand).</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" checked={b.wantsReminder} onChange={(e) => b.setWantsReminder(e.target.checked)} className="mt-0.5" />
          <span>Herinner mij één dag van tevoren per e-mail.</span>
        </label>
      </div>
      <button type="button" onClick={onNext} className="w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground sm:w-auto">
        Controleren & bevestigen
      </button>
    </div>
  );
}

function ConfirmStep({
  b,
  businessName,
  onConfirm,
}: {
  b: GentrixPublicBookingController;
  businessName: string;
  onConfirm: () => void;
}) {
  const meta = b.meta!;
  if (!b.selectedSlot) return null;

  const whenLabel = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: meta.timeZone,
  }).format(new Date(b.selectedSlot.starts_at));

  const staffName =
    b.staffForDay.requiresStaffSelection && b.pickedStaffId
      ? b.staffForDay.staff.find((x) => x.id === b.pickedStaffId)?.name
      : null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Controleer je afspraak</h2>
      <ul className="space-y-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <li>
          <span className="text-muted-foreground">Locatie / zaak:</span> <span className="font-medium">{businessName}</span>
        </li>
        {b.selectedService ? (
          <li>
            <span className="text-muted-foreground">Behandeling:</span> <span className="font-medium">{b.selectedService.name}</span>
          </li>
        ) : null}
        {staffName ? (
          <li>
            <span className="text-muted-foreground">Medewerker:</span> <span className="font-medium">{staffName}</span>
          </li>
        ) : null}
        <li>
          <span className="text-muted-foreground">Datum & tijd:</span> <span className="font-medium">{whenLabel}</span>
        </li>
        <li>
          <span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{b.bookerEmail.trim()}</span>
        </li>
        {b.bookerName.trim() ? (
          <li>
            <span className="text-muted-foreground">Naam:</span> <span className="font-medium">{b.bookerName.trim()}</span>
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        disabled={b.saving}
        onClick={onConfirm}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
      >
        {b.saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Definitief boeken
      </button>
    </div>
  );
}

function SuccessStep({
  businessName,
  hadConfirmation,
  onNew,
}: {
  businessName: string;
  hadConfirmation: boolean;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4 text-center sm:text-left">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/15 sm:mx-0">
        <Check className="size-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Afspraak geboekt</h2>
      <p className="text-sm text-muted-foreground">
        Je afspraak bij {businessName} is opgeslagen.
        {hadConfirmation ? (
          <>
            {" "}
            Je ontvangt een <strong>bevestiging per e-mail</strong> met een agenda-bestand (.ics).
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-2 w-full rounded-lg border border-border bg-background px-6 py-2.5 text-sm font-medium hover:bg-muted sm:w-auto"
      >
        Nieuwe afspraak boeken
      </button>
    </div>
  );
}
