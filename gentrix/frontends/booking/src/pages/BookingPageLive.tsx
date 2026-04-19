import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { TZDate } from "@date-fns/tz";
import {
  useGentrixPublicBooking,
  type GentrixPublicBookingController,
} from "@/hooks/use-gentrix-public-booking";
import { ymdCompare, type PublicBookingService, type BookingMeta } from "@/lib/gentrix-booking-helpers";
import { cn } from "@/lib/utils";
import { ServiceSelect } from "@/components/booking/ServiceSelect";
import { EmployeeSelect } from "@/components/booking/EmployeeSelect";
import { CustomerForm } from "@/components/booking/CustomerForm";
import { BookingConfirm } from "@/components/booking/BookingConfirm";
import { BookingSuccess } from "@/components/booking/BookingSuccess";
import type { CustomerInfo, Employee, Service, WeekSchedule } from "@/types";

const ACCENT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ec4899"];

const emptyWeek = {} as WeekSchedule;

function publicServiceToService(svc: PublicBookingService, index: number): Service {
  return {
    id: svc.id,
    businessId: "gentrix-live",
    name: svc.name,
    description: svc.description?.trim() ?? "",
    duration: svc.duration_minutes,
    price: svc.price_cents != null ? svc.price_cents / 100 : null,
    color: ACCENT_COLORS[index % ACCENT_COLORS.length]!,
    active: true,
    employeeIds: [],
  };
}

function staffMemberToEmployee(row: { id: string; name: string }): Employee {
  return {
    id: row.id,
    businessId: "gentrix-live",
    name: row.name,
    role: "Medewerker",
    specialization: "Online boeken",
    serviceIds: [],
    schedule: emptyWeek,
    breaks: [],
    daysOff: [],
    active: true,
  };
}

function placeholderService(meta: BookingMeta, name: string): Service {
  return {
    id: "default",
    businessId: "gentrix-live",
    name,
    description: "",
    duration: meta.slotDurationMinutes,
    price: null,
    color: ACCENT_COLORS[0]!,
    active: true,
    employeeIds: [],
  };
}

function placeholderEmployee(label: string): Employee {
  return {
    id: "team",
    businessId: "gentrix-live",
    name: label,
    role: "",
    specialization: "",
    serviceIds: [],
    schedule: emptyWeek,
    breaks: [],
    daysOff: [],
    active: true,
  };
}

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

  const showEmployeeStep = !b.staffCatalog.loading && !b.staffCatalog.err && b.staffCatalog.staff.length > 1;

  const flowSteps = useMemo(() => {
    const out: { id: Exclude<LiveStep, "success">; label: string }[] = [];
    if (b.requiresTreatmentChoice) out.push({ id: "service", label: "Dienst" });
    if (showEmployeeStep) out.push({ id: "employee", label: "Medewerker" });
    out.push(
      { id: "datetime", label: "Datum & tijd" },
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

  const serviceForUi: Service | null = useMemo(() => {
    if (!b.meta) return null;
    if (b.selectedService) {
      const idx = b.publicServices.findIndex((s) => s.id === b.selectedService!.id);
      return publicServiceToService(b.selectedService, Math.max(0, idx));
    }
    return placeholderService(b.meta, "Afspraak");
  }, [b.meta, b.selectedService, b.publicServices]);

  const employeeForUi: Employee | null = useMemo(() => {
    if (!b.pickedStaffId) return placeholderEmployee(businessLabel);
    const row = b.staffCatalog.staff.find((s) => s.id === b.pickedStaffId);
    return row ? staffMemberToEmployee(row) : placeholderEmployee(businessLabel);
  }, [b.pickedStaffId, b.staffCatalog.staff, businessLabel]);

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

  function goNextFromDatetime() {
    if (!b.selectedSlot) {
      b.setErr("Kies een datum en tijdslot.");
      return;
    }
    b.setErr(null);
    setStep("details");
  }

  function handleCustomerSubmit(info: CustomerInfo) {
    b.setBookerName(info.name);
    b.setBookerEmail(info.email);
    const phone = info.phone?.trim();
    const extra = info.notes?.trim();
    const parts: string[] = [];
    if (phone) parts.push(`Tel: ${phone}`);
    if (extra) parts.push(extra);
    b.setNotes(parts.join("\n"));
    b.setErr(null);
    setStep("confirm");
  }

  async function confirmAndBook() {
    const r = await b.submitBooking();
    if (r.ok) {
      setStep("success");
    }
  }

  function newBooking() {
    b.resetFlow();
    didInitStep.current = false;
    if (b.requiresTreatmentChoice) setStep("service");
    else if (showEmployeeStep) setStep("employee");
    else setStep("datetime");
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
                <div>
                  {b.servicesLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Behandelingen laden…
                    </p>
                  ) : (
                    <>
                      <ServiceSelect
                        selectedServiceId={b.selectedServiceId}
                        services={b.publicServices.map((s, i) => publicServiceToService(s, i))}
                        onSelect={(svc) => {
                          b.selectService(svc.id);
                        }}
                      />
                      <button
                        type="button"
                        onClick={goNextFromService}
                        className="mt-6 w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
                      >
                        Verder
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {step === "employee" ? (
                <div>
                  <EmployeeSelect
                    selectedEmployeeId={b.pickedStaffId}
                    employees={b.staffCatalog.staff.map(staffMemberToEmployee)}
                    onSelect={(emp) => {
                      b.setPickedStaffId(emp.id);
                      b.setSelectedYmd(null);
                      b.setSelectedSlot(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={goNextFromEmployee}
                    className="mt-6 w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
                  >
                    Verder naar datum & tijd
                  </button>
                </div>
              ) : null}

              {step === "datetime" ? <LiveDateTimeStep b={b} meta={meta} onNext={goNextFromDatetime} /> : null}

              {step === "details" ? (
                <div className="space-y-6">
                  <CustomerForm
                    phoneOptional
                    initialData={{
                      name: b.bookerName,
                      email: b.bookerEmail,
                      phone: "",
                      notes: b.notes,
                    }}
                    onSubmit={handleCustomerSubmit}
                  />
                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Soort afspraak (optioneel)
                      <input
                        value={b.title}
                        onChange={(e) => b.setTitle(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Bijv. Intake"
                      />
                    </label>
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
                </div>
              ) : null}

              {step === "confirm" && serviceForUi && employeeForUi && selectedDateForConfirm && b.selectedSlot ? (
                <BookingConfirm
                  service={serviceForUi}
                  employee={employeeForUi}
                  date={selectedDateForConfirm}
                  time={timeLabelForConfirm}
                  customer={{
                    name: b.bookerName.trim() || "—",
                    email: b.bookerEmail.trim(),
                    phone: "",
                    notes: b.notes.trim() || undefined,
                  }}
                  confirmDisabled={b.saving}
                  onConfirm={() => void confirmAndBook()}
                />
              ) : null}

              {step === "success" && serviceForUi && employeeForUi && selectedDateForConfirm && b.selectedSlot ? (
                <BookingSuccess
                  service={serviceForUi}
                  employee={employeeForUi}
                  date={selectedDateForConfirm}
                  time={timeLabelForConfirm}
                  onNewBooking={newBooking}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function LiveDateTimeStep({
  b,
  meta,
  onNext,
}: {
  b: GentrixPublicBookingController;
  meta: NonNullable<GentrixPublicBookingController["meta"]>;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Datum & tijd</h2>
        <p className="mt-1 text-muted-foreground">
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

              {b.staffCatalog.staff.length === 1 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Je boekt bij <strong>{b.staffCatalog.staff[0]!.name}</strong>.
                </p>
              ) : null}

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

              <button
                type="button"
                onClick={onNext}
                disabled={!b.selectedSlot}
                className="mt-8 w-full rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:w-auto"
              >
                Verder naar gegevens
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selecteer eerst een datum in de kalender.</p>
          )}
        </>
      )}
    </div>
  );
}
