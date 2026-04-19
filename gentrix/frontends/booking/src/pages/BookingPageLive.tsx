import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { PublicBookingSlot } from "@/lib/gentrix-booking-helpers";
import {
  LiveConfirmCard,
  LiveDetailsForm,
  LiveEmployeePick,
  LiveServicePick,
  LiveSuccessCard,
} from "@/components/booking/live-booking-steps";
import { useGentrixPublicBooking, type GentrixPublicBookingController } from "@/hooks/use-gentrix-public-booking";
import { ymdCompare } from "@/lib/gentrix-booking-helpers";
import { cn } from "@/lib/utils";

type LiveStep = "service" | "employee" | "datetime" | "details" | "confirm" | "success";

export default function BookingPageLive() {
  const { slug: rawSlug } = useParams();
  const slug = decodeURIComponent(rawSlug ?? "").trim();
  const b = useGentrixPublicBooking({ slug });
  const [step, setStep] = useState<LiveStep>("datetime");
  const didInitStep = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      didInitStep.current = false;
    });
  }, [slug]);

  /** Zelfde flow als BookFlow (zip): medewerker-stap ook bij één persoon (kaart + “Verder”). */
  const showEmployeeStep =
    !b.staffCatalog.loading && !b.staffCatalog.err && b.staffCatalog.staff.length >= 1;

  const flowSteps = useMemo(() => {
    const out: { id: Exclude<LiveStep, "success">; label: string }[] = [];
    if (b.requiresTreatmentChoice) out.push({ id: "service", label: "Dienst" });
    if (showEmployeeStep) out.push({ id: "employee", label: "Medewerker" });
    out.push(
      { id: "datetime", label: "Datum & Tijd" },
      { id: "details", label: "Gegevens" },
      { id: "confirm", label: "Bevestig" },
    );
    return out;
  }, [b.requiresTreatmentChoice, showEmployeeStep]);

  useEffect(() => {
    if (b.servicesLoading || b.staffCatalog.loading) return;
    if (didInitStep.current) return;
    didInitStep.current = true;
    if (b.requiresTreatmentChoice) setStep("service");
    else if (showEmployeeStep) setStep("employee");
    else setStep("datetime");
  }, [b.servicesLoading, b.staffCatalog.loading, b.requiresTreatmentChoice, showEmployeeStep]);

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
    if (step === "datetime") {
      if (showEmployeeStep) setStep("employee");
      else if (b.requiresTreatmentChoice) setStep("service");
      return;
    }
    if (step === "employee") {
      if (b.requiresTreatmentChoice) setStep("service");
      return;
    }
  }

  function goNextFromService() {
    if (!b.selectedServiceId) {
      b.setErr("Kies een behandeling.");
      return;
    }
    b.setErr(null);
    if (showEmployeeStep) setStep("employee");
    else setStep("datetime");
  }

  function goNextFromEmployee() {
    if (!b.pickedStaffId) {
      b.setErr("Kies een medewerker.");
      return;
    }
    b.setErr(null);
    setStep("datetime");
  }

  /** Net als `DateTimeSelect` in de zip: één klik op een tijd gaat door naar gegevens. */
  function pickSlotAndContinue(slot: PublicBookingSlot) {
    b.setSelectedSlot(slot);
    b.setErr(null);
    setStep("details");
  }

  async function confirmAndBook() {
    const r = await b.submitBooking();
    if (r.ok) {
      setStep("success");
    }
  }

  function newBooking() {
    b.resetFlow();
    if (b.requiresTreatmentChoice) setStep("service");
    else if (showEmployeeStep) setStep("employee");
    else setStep("datetime");
    didInitStep.current = true;
  }

  if (!slug) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 text-center text-muted-foreground">
        Geen studio-slug in de URL. Gebruik <code className="rounded bg-muted px-1">/booking-app/book/mosham</code> (voorbeeld).
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

  const selectedDateForConfirm: Date | null = b.selectedYmd
    ? (() => {
        const [sy, sm, sd] = b.selectedYmd.split("-").map(Number);
        return new TZDate(sy, sm - 1, sd, 12, 0, 0, meta.timeZone);
      })()
    : null;

  const timeLabelForConfirm = b.selectedSlot ? b.slotLabel(b.selectedSlot) : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-heading text-lg font-bold">{businessLabel}</span>
        </div>
      </header>
      <main className="container py-10">
        <div className="mx-auto max-w-2xl">
          {b.staffCatalog.err ? (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {b.staffCatalog.err}
            </p>
          ) : null}
          {b.err ? (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{b.err}</p>
          ) : null}

          {step !== "success" ? (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-1 px-2">
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
                          active && !done && "bg-primary text-primary-foreground ring-4 ring-accent",
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
                      <div className={cn("mx-2 h-0.5 min-w-[12px] flex-1", done ? "bg-primary" : "bg-muted")} />
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {step === "service" ? (
                <LiveServicePick
                  services={b.publicServices}
                  selectedId={b.selectedServiceId}
                  loading={b.servicesLoading}
                  onSelect={(id) => b.selectService(id)}
                  onNext={goNextFromService}
                />
              ) : null}

              {step === "employee" ? (
                <LiveEmployeePick
                  staff={b.staffCatalog.staff}
                  selectedId={b.pickedStaffId}
                  onSelect={(id) => {
                    b.setPickedStaffId(id);
                    b.setSelectedYmd(null);
                    b.setSelectedSlot(null);
                  }}
                  onNext={goNextFromEmployee}
                />
              ) : null}

              {step === "datetime" ? (
                <LiveDateTimeStep b={b} meta={meta} businessLabel={businessLabel} onSlotPickContinue={pickSlotAndContinue} />
              ) : null}

              {step === "details" ? <LiveDetailsForm b={b} onContinue={() => setStep("confirm")} /> : null}

              {step === "confirm" && selectedDateForConfirm && b.selectedSlot ? (
                <LiveConfirmCard
                  b={b}
                  meta={meta}
                  businessLabel={businessLabel}
                  date={selectedDateForConfirm}
                  timeLabel={timeLabelForConfirm}
                  onConfirm={() => void confirmAndBook()}
                />
              ) : null}

              {step === "success" && selectedDateForConfirm && b.selectedSlot ? (
                <LiveSuccessCard
                  b={b}
                  businessLabel={businessLabel}
                  date={selectedDateForConfirm}
                  timeLabel={timeLabelForConfirm}
                  onNew={newBooking}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function ymdFromLocalCalendarDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function LiveDateTimeStep({
  b,
  meta,
  businessLabel,
  onSlotPickContinue,
}: {
  b: GentrixPublicBookingController;
  meta: NonNullable<GentrixPublicBookingController["meta"]>;
  businessLabel: string;
  onSlotPickContinue: (slot: PublicBookingSlot) => void;
}) {
  const selectedCalendarDate =
    b.selectedYmd != null
      ? (() => {
          const [y, mo, da] = b.selectedYmd.split("-").map(Number);
          return new Date(y, mo - 1, da);
        })()
      : undefined;

  const staffName =
    b.pickedStaffId != null ? b.staffCatalog.staff.find((s) => s.id === b.pickedStaffId)?.name ?? "" : "";
  const svc = b.selectedService;
  const dur = svc ? svc.duration_minutes : meta.slotDurationMinutes;
  const summaryLeft = svc ? `${svc.name} bij ${staffName || businessLabel}` : staffName || businessLabel;

  return (
    <div>
      <h2 className="mb-2 font-heading text-2xl font-bold">{"Kies datum & tijd"}</h2>
      <p className="mb-6 text-muted-foreground">
        {summaryLeft} · {dur} min
      </p>

      {b.requiresTreatmentChoice && !b.selectedServiceId ? (
        <p className="text-sm text-muted-foreground">Ga eerst terug en kies een behandeling.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              locale={nl}
              selected={selectedCalendarDate}
              onSelect={(d) => {
                if (!d) return;
                b.setSelectedYmd(ymdFromLocalCalendarDate(d));
              }}
              disabled={(date) => {
                const ymd = ymdFromLocalCalendarDate(date);
                return ymdCompare(ymd, meta.todayYmd) < 0 || ymdCompare(ymd, meta.maxYmd) > 0;
              }}
              className="pointer-events-auto rounded-lg border"
            />
          </div>

          <div>
            {b.selectedYmd ? (
              <div>
                <h3 className="mb-3 font-heading font-semibold">
                  {(() => {
                    const [sy, sm, sd] = b.selectedYmd!.split("-").map(Number);
                    return format(new TZDate(sy, sm - 1, sd, 12, 0, 0, meta.timeZone), "EEEE d MMMM", { locale: nl });
                  })()}
                </h3>
                {b.loadingSlots ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Slots laden…
                  </p>
                ) : b.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Geen beschikbare tijden op deze dag.</p>
                ) : (
                  <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
                    {b.slots.map((s) => (
                      <Button
                        key={s.starts_at}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSlotPickContinue(s)}
                        className="hover:bg-primary hover:text-primary-foreground"
                      >
                        {b.slotLabel(s)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecteer een datum om beschikbare tijden te zien.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
